<?php

namespace Tests\Feature;

use App\Jobs\DeleteMerchantFilesJob;
use App\Models\Account;
use App\Models\DeliveryNoteImport;
use App\Models\EntityFile;
use App\Models\FileType;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleLocationHistory;
use App\Services\DataPurgeService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DataPurgeCleanupTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('migrate:fresh', ['--force' => true]);
        \Illuminate\Foundation\Testing\RefreshDatabaseState::$migrated = false;
    }

    private function merchant(): Merchant
    {
        $user = User::factory()->create();
        $account = Account::create(['owner_user_id' => $user->id]);

        return Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $user->id]);
    }

    private function vehicle(Merchant $merchant): Vehicle
    {
        return Vehicle::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'plate_number' => 'TEST-'.$merchant->id]);
    }

    private function history(Merchant $merchant, Vehicle $vehicle, ?Run $run, string $key): void
    {
        VehicleLocationHistory::create([
            'account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicle->id, 'merchant_integration_id' => 1, 'run_id' => $run?->id,
            'stationary' => true, 'observed_at' => '2026-11-16 10:00:00',
            'last_seen_at' => '2026-11-16 10:05:00', 'received_at' => now(),
            'latitude' => 0, 'longitude' => 0, 'last_latitude' => 0, 'last_longitude' => 0,
            'first_sample_key' => $key,
        ]);
        foreach (['10:00:00', '10:03:00'] as $index => $time) {
            DB::table('vehicle_location_receipts')->insert(['sample_key' => $key.$index, 'vehicle_id' => $vehicle->id, 'observed_at' => '2026-11-16 '.$time.'.000000']);
        }
    }

    public static function gpsTypes(): array
    {
        return [['runs'], ['vehicles'], ['vehicle_activity']];
    }

    #[DataProvider('gpsTypes')]
    public function test_gps_cleanup_is_scoped_and_includes_merged_receipts(string $type): void
    {
        $merchant = $this->merchant();
        $other = $this->merchant();
        $vehicle = $this->vehicle($merchant);
        $otherVehicle = $this->vehicle($other);
        $run = Run::create(['merchant_id' => $merchant->id, 'account_id' => $merchant->account_id, 'vehicle_id' => $vehicle->id]);
        $this->history($merchant, $vehicle, $run, 'selected');
        $this->history($other, $otherVehicle, null, 'other');
        $result = app(DataPurgeService::class)->purgeWithoutActivityLog($merchant, [$type]);
        $this->assertSame(1, $result['results'][$type]['tables']['vehicle_location_history']);
        $this->assertSame(2, $result['results'][$type]['tables']['vehicle_location_receipts']);
        $this->assertDatabaseMissing('vehicle_location_history', ['merchant_id' => $merchant->id]);
        $this->assertDatabaseHas('vehicle_location_history', ['merchant_id' => $other->id]);
        $this->assertDatabaseCount('vehicle_location_receipts', 2);
        $this->assertDatabaseHas('vehicles', ['id' => $otherVehicle->id]);
    }

    public function test_vehicle_with_other_merchant_history_and_receipts_is_preserved(): void
    {
        $merchant = $this->merchant();
        $other = $this->merchant();
        $vehicle = $this->vehicle($merchant);
        $this->history($other, $vehicle, null, 'shared');
        app(DataPurgeService::class)->purgeWithoutActivityLog($merchant, ['vehicles']);
        $this->assertDatabaseHas('vehicles', ['id' => $vehicle->id]);
        $this->assertDatabaseCount('vehicle_location_receipts', 2);
        $this->assertDatabaseCount('vehicle_location_history', 1);
    }

    public function test_activity_receipts_page_through_retained_samples_with_identical_timestamps(): void
    {
        $merchant = $this->merchant();
        $other = $this->merchant();
        $vehicle = $this->vehicle($merchant);
        $this->history($merchant, $vehicle, null, 'selected');
        $this->history($other, $vehicle, null, 'retained');
        // The first 300 candidates are protected by the other merchant's history.
        // The next 300 only belong to the selected merchant's extended interval.
        DB::table('vehicle_location_history')->where('merchant_id', $merchant->id)->update(['last_seen_at' => '2026-11-16 10:10:00']);
        for ($i = 0; $i < 600; $i++) {
            DB::table('vehicle_location_receipts')->insert([
                'sample_key' => sprintf('batch-%04d', $i), 'vehicle_id' => $vehicle->id,
                'observed_at' => $i < 300 ? '2026-11-16 10:03:00.000000' : '2026-11-16 10:08:00.000000',
            ]);
        }
        $queries = [];
        DB::listen(function ($query) use (&$queries) { $queries[] = $query->sql; });
        $result = app(DataPurgeService::class)->purgeWithoutActivityLog($merchant, ['vehicle_activity']);
        $this->assertSame(300, $result['results']['vehicle_activity']['tables']['vehicle_location_receipts']);
        $this->assertDatabaseCount('vehicle_location_receipts', 304);
        $this->assertDatabaseHas('vehicle_location_history', ['merchant_id' => $other->id]);
        $this->assertEmpty(array_filter($queries, fn ($sql) => str_contains($sql, 'max("sample_key")')));
        $this->assertEmpty(array_filter($queries, fn ($sql) => str_contains($sql, 'not in (select')));
    }

    public function test_activity_cancellation_keeps_committed_receipt_batches(): void
    {
        $merchant = $this->merchant();
        $vehicle = $this->vehicle($merchant);
        $this->history($merchant, $vehicle, null, 'selected');
        for ($i = 0; $i < 300; $i++) {
            DB::table('vehicle_location_receipts')->insert([
                'sample_key' => sprintf('batch-%04d', $i), 'vehicle_id' => $vehicle->id,
                'observed_at' => '2026-11-16 10:03:00.000000',
            ]);
        }
        $queries = [];
        DB::listen(function ($query) use (&$queries) { $queries[] = $query->sql; });
        try {
            app(DataPurgeService::class)->purgeIncrementally(User::findOrFail($merchant->owner_user_id), $merchant, ['vehicle_activity'],
                function ($done, $total, $type, $ordered, $rows) {
                    if ($rows >= 250) {
                        $this->assertSame(0, DB::transactionLevel());
                        throw new \RuntimeException('Stop after batch');
                    }
                }, fn () => null);
            $this->fail('Expected cancellation checkpoint.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Stop after batch', $exception->getMessage());
        }
        $receiptDeletes = array_filter($queries, fn ($sql) => str_starts_with($sql, 'delete from "vehicle_location_receipts"'));
        $this->assertCount(1, $receiptDeletes);
        $this->assertStringNotContainsString('last_seen_at', implode(' ', $receiptDeletes));
        $this->assertDatabaseCount('vehicle_location_receipts', 52);
        $this->assertDatabaseCount('vehicle_location_history', 1);
    }

    private function attachment(Merchant $merchant, Vehicle $vehicle, string $path): EntityFile
    {
        $type = FileType::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'entity_type' => 'vehicle', 'name' => 'Document', 'slug' => 'doc']);
        Storage::disk('local')->put($path, 'document');

        return EntityFile::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'file_type_id' => $type->id, 'attachable_type' => Vehicle::class, 'attachable_id' => $vehicle->id, 'disk' => 'local', 'path' => $path, 'original_name' => 'doc.pdf', 'deleted_at' => now()]);
    }

    public function test_files_are_deleted_only_after_commit_and_other_merchant_files_remain(): void
    {
        Storage::fake('local');
        $merchant = $this->merchant();
        $other = $this->merchant();
        $file = $this->attachment($merchant, $this->vehicle($merchant), 'selected.pdf');
        $file->delete();
        $otherFile = $this->attachment($other, $this->vehicle($other), 'other.pdf');
        DB::beginTransaction();
        app(DataPurgeService::class)->purgeWithoutActivityLog($merchant, ['vehicles']);
        Storage::disk('local')->assertExists('selected.pdf');
        DB::commit();
        Storage::disk('local')->assertMissing('selected.pdf');
        Storage::disk('local')->assertExists('other.pdf');
        $this->assertDatabaseMissing('entity_files', ['id' => $file->id]);
        $this->assertDatabaseHas('entity_files', ['id' => $otherFile->id]);
    }

    public function test_rollback_keeps_file_and_attachment(): void
    {
        Storage::fake('local');
        $merchant = $this->merchant();
        $file = $this->attachment($merchant, $this->vehicle($merchant), 'rollback.pdf');
        DB::beginTransaction();
        app(DataPurgeService::class)->purgeWithoutActivityLog($merchant, ['vehicles']);
        DB::rollBack();
        Storage::disk('local')->assertExists('rollback.pdf');
        $this->assertDatabaseHas('entity_files', ['id' => $file->id]);
    }

    public function test_run_import_files_are_removed_but_standalone_imports_remain(): void
    {
        Storage::fake('local');
        $merchant = $this->merchant();
        $run = Run::create(['merchant_id' => $merchant->id, 'account_id' => $merchant->account_id]);
        foreach (['run.pdf' => $run->id, 'standalone.pdf' => null] as $path => $runId) {
            Storage::disk('local')->put($path, 'note');
            DeliveryNoteImport::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'run_id' => $runId, 'disk' => 'local', 'path' => $path, 'original_name' => $path, 'mime_type' => 'application/pdf', 'size_bytes' => 4]);
        }
        app(DataPurgeService::class)->purgeWithoutActivityLog($merchant, ['runs']);
        Storage::disk('local')->assertMissing('run.pdf');
        Storage::disk('local')->assertExists('standalone.pdf');
        app(DataPurgeService::class)->purgeWithoutActivityLog($merchant, ['shipments']);
        Storage::disk('local')->assertMissing('standalone.pdf');
        $this->assertDatabaseCount('delivery_note_imports', 0);
    }

    public function test_shared_storage_path_is_retained_until_last_reference_is_deleted(): void
    {
        Storage::fake('local');
        $merchant = $this->merchant();
        $other = $this->merchant();
        $this->attachment($merchant, $this->vehicle($merchant), 'shared.pdf');
        $this->attachment($other, $this->vehicle($other), 'shared.pdf');
        app(DataPurgeService::class)->purgeWithoutActivityLog($merchant, ['vehicles']);
        Storage::disk('local')->assertExists('shared.pdf');
        app(DataPurgeService::class)->purgeWithoutActivityLog($other, ['vehicles']);
        Storage::disk('local')->assertMissing('shared.pdf');
    }

    public function test_run_purge_preserves_receipts_covered_by_retained_history(): void
    {
        $merchant = $this->merchant();
        $vehicle = $this->vehicle($merchant);
        $run = Run::create(['merchant_id' => $merchant->id, 'account_id' => $merchant->account_id, 'vehicle_id' => $vehicle->id]);
        $this->history($merchant, $vehicle, $run, 'run');
        $this->history($merchant, $vehicle, null, 'retained');
        app(DataPurgeService::class)->purgeWithoutActivityLog($merchant, ['runs']);
        $this->assertDatabaseCount('vehicle_location_history', 1);
        $this->assertDatabaseCount('vehicle_location_receipts', 4);
        app(DataPurgeService::class)->purgeWithoutActivityLog($merchant, ['vehicle_activity']);
        $this->assertDatabaseCount('vehicle_location_history', 0);
        $this->assertDatabaseCount('vehicle_location_receipts', 0);
    }

    public function test_storage_failures_are_retryable(): void
    {
        Storage::shouldReceive('disk')->with('local')->andReturnSelf();
        Storage::shouldReceive('delete')->with(['failed.pdf'])->andReturn(false);
        $this->expectException(\RuntimeException::class);
        (new DeleteMerchantFilesJob([['disk' => 'local', 'path' => 'failed.pdf']]))->handle();
    }
}
