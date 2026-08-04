<?php

namespace Tests\Feature;

use App\Jobs\DeleteMerchantFilesJob;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Carrier;
use App\Models\DeliveryNoteImport;
use App\Models\Driver;
use App\Models\EntityFile;
use App\Models\FileType;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MerchantDeletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_account_holder_can_permanently_delete_merchant_and_purge_its_data(): void
    {
        Queue::fake();

        $user = User::factory()->create(['password' => 'password']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->update(['account_id' => $account->id]);

        $nextMerchant = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
            'name' => 'Next Merchant',
            'created_at' => now(),
        ]);
        $merchant = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
            'name' => 'Delete Merchant',
            'logo_path' => 'merchant-logos/delete/logo.png',
            'created_at' => now()->subDay(),
        ]);

        $merchant->users()->attach($user->id, ['role' => 'owner']);
        $nextMerchant->users()->attach($user->id, ['role' => 'owner']);
        $user->forceFill(['last_accessed_merchant_id' => $merchant->id])->save();

        $carrier = Carrier::create([
            'merchant_id' => $merchant->id,
            'code' => 'DELETE-CARRIER',
            'name' => 'Delete Carrier',
            'type' => 'internal',
            'enabled' => true,
        ]);
        $vehicle = Vehicle::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'make' => 'Delete',
            'model' => 'Me',
            'plate_number' => 'DELETE-1',
        ]);
        $activity = VehicleActivity::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicle->id,
            'event_type' => VehicleActivity::EVENT_MOVING,
            'occurred_at' => now(),
        ]);
        $activityLog = ActivityLog::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'actor_user_id' => $user->id,
            'action' => 'created',
            'entity_type' => 'merchant',
            'entity_id' => $merchant->id,
            'entity_uuid' => $merchant->uuid,
            'occurred_at' => now(),
        ]);
        $fileType = FileType::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'entity_type' => FileType::ENTITY_VEHICLE,
            'name' => 'Deletion Document',
            'slug' => 'deletion-document',
        ]);
        $entityFile = EntityFile::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'file_type_id' => $fileType->id,
            'attachable_type' => Vehicle::class,
            'attachable_id' => $vehicle->id,
            'disk' => 'local',
            'path' => 'merchant-files/delete/document.pdf',
            'original_name' => 'document.pdf',
        ]);
        $run = Run::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'status' => Run::STATUS_DRAFT,
        ]);
        $deliveryNoteImport = DeliveryNoteImport::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'run_id' => $run->id,
            'uploaded_by_user_id' => $user->id,
            'status' => DeliveryNoteImport::STATUS_ANALYZED,
            'disk' => 's3',
            'path' => 'delivery-note-imports/delete/note.pdf',
            'original_name' => 'note.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 100,
        ]);

        $response = $this->authenticated($user)->deleteJson(
            "/api/v1/merchants/{$merchant->uuid}",
            ['password' => 'password']
        );

        $response->assertOk()
            ->assertJsonPath('data.message', 'Merchant deleted successfully.')
            ->assertJsonPath('data.deleted_merchant_id', $merchant->uuid)
            ->assertJsonPath('data.next_merchant.merchant_id', $nextMerchant->uuid);

        $this->assertDatabaseMissing('merchants', ['id' => $merchant->id]);
        $this->assertDatabaseMissing('merchant_user', ['merchant_id' => $merchant->id]);
        $this->assertDatabaseMissing('carriers', ['id' => $carrier->id]);
        $this->assertDatabaseMissing('vehicles', ['id' => $vehicle->id]);
        $this->assertDatabaseMissing('vehicle_activity', ['id' => $activity->id]);
        $this->assertDatabaseMissing('activity_logs', ['id' => $activityLog->id]);
        $this->assertDatabaseMissing('entity_files', ['id' => $entityFile->id]);
        $this->assertDatabaseMissing('delivery_note_imports', ['id' => $deliveryNoteImport->id]);
        $this->assertDatabaseHas('merchants', ['id' => $nextMerchant->id]);
        $this->assertSame($nextMerchant->id, $user->fresh()->last_accessed_merchant_id);

        Queue::assertPushed(DeleteMerchantFilesJob::class, function (DeleteMerchantFilesJob $job): bool {
            $files = collect($job->files);

            return $files->contains(fn (array $file) => $file['disk'] === 's3' && $file['path'] === 'merchant-logos/delete/logo.png')
                && $files->contains(fn (array $file) => $file['disk'] === 'local' && $file['path'] === 'merchant-files/delete/document.pdf')
                && $files->contains(fn (array $file) => $file['disk'] === 's3' && $file['path'] === 'delivery-note-imports/delete/note.pdf');
        });
    }

    public function test_delete_rejects_an_incorrect_password_without_changing_data(): void
    {
        [$user, $merchant] = $this->accountHolderWithMerchants(2);

        $this->authenticated($user)
            ->deleteJson("/api/v1/merchants/{$merchant->uuid}", ['password' => 'wrong-password'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'INVALID_PASSWORD');

        $this->assertDatabaseHas('merchants', ['id' => $merchant->id, 'deleted_at' => null]);
    }

    public function test_delete_rejects_a_missing_password(): void
    {
        [$user, $merchant] = $this->accountHolderWithMerchants(2);

        $this->authenticated($user)
            ->deleteJson("/api/v1/merchants/{$merchant->uuid}")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION');

        $this->assertDatabaseHas('merchants', ['id' => $merchant->id, 'deleted_at' => null]);
    }

    public function test_delete_rejects_the_last_accessible_merchant(): void
    {
        [$user, $merchant] = $this->accountHolderWithMerchants(1);

        $this->authenticated($user)
            ->deleteJson("/api/v1/merchants/{$merchant->uuid}", ['password' => 'password'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'LAST_MERCHANT_REQUIRED');

        $this->assertDatabaseHas('merchants', ['id' => $merchant->id, 'deleted_at' => null]);
    }

    public function test_member_cannot_delete_a_merchant(): void
    {
        [$accountHolder, $merchant] = $this->accountHolderWithMerchants(2);
        $member = User::factory()->create([
            'account_id' => $accountHolder->account_id,
            'password' => 'password',
        ]);
        $merchant->users()->attach($member->id, ['role' => 'admin']);

        $this->authenticated($member)
            ->deleteJson("/api/v1/merchants/{$merchant->uuid}", ['password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');

        $this->assertDatabaseHas('merchants', ['id' => $merchant->id, 'deleted_at' => null]);
    }

    public function test_super_admin_can_still_delete_a_merchant_with_a_password(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'password' => 'password',
        ]);
        $merchant = Merchant::factory()->create(['created_at' => now()->subDay()]);
        $nextMerchant = Merchant::factory()->create(['created_at' => now()]);

        $this->authenticated($superAdmin)
            ->deleteJson("/api/v1/merchants/{$merchant->uuid}", ['password' => 'password'])
            ->assertOk()
            ->assertJsonPath('data.next_merchant.merchant_id', $nextMerchant->uuid);

        $this->assertDatabaseMissing('merchants', ['id' => $merchant->id]);
    }

    public function test_resources_referenced_by_another_merchant_are_preserved(): void
    {
        [$user, $merchant, $otherMerchant] = $this->accountHolderWithMerchants(2);
        $driverUser = User::factory()->create(['account_id' => $user->account_id]);
        $driver = Driver::create([
            'account_id' => $user->account_id,
            'merchant_id' => $merchant->id,
            'user_id' => $driverUser->id,
            'is_active' => true,
        ]);
        $vehicle = Vehicle::create([
            'account_id' => $user->account_id,
            'merchant_id' => $merchant->id,
            'make' => 'Shared',
            'model' => 'Vehicle',
            'plate_number' => 'SHARED-1',
        ]);
        $run = Run::create([
            'account_id' => $user->account_id,
            'merchant_id' => $otherMerchant->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'status' => Run::STATUS_DRAFT,
        ]);

        $this->authenticated($user)
            ->deleteJson("/api/v1/merchants/{$merchant->uuid}", ['password' => 'password'])
            ->assertOk();

        $this->assertDatabaseHas('drivers', ['id' => $driver->id, 'merchant_id' => null]);
        $this->assertDatabaseHas('vehicles', ['id' => $vehicle->id, 'merchant_id' => null]);
        $this->assertDatabaseHas('runs', [
            'id' => $run->id,
            'merchant_id' => $otherMerchant->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
        ]);
    }

    public function test_storage_cleanup_job_deletes_files_from_each_disk(): void
    {
        Storage::fake('s3');
        Storage::fake('local');
        Storage::disk('s3')->put('merchant-logos/delete/logo.png', 'logo');
        Storage::disk('local')->put('merchant-files/delete/document.pdf', 'document');

        (new DeleteMerchantFilesJob([
            ['disk' => 's3', 'path' => 'merchant-logos/delete/logo.png'],
            ['disk' => 'local', 'path' => 'merchant-files/delete/document.pdf'],
        ]))->handle();

        Storage::disk('s3')->assertMissing('merchant-logos/delete/logo.png');
        Storage::disk('local')->assertMissing('merchant-files/delete/document.pdf');
    }

    private function accountHolderWithMerchants(int $count): array
    {
        $user = User::factory()->create(['password' => 'password']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->update(['account_id' => $account->id]);

        $merchants = collect(range(1, $count))->map(function (int $position) use ($account, $user) {
            $merchant = Merchant::factory()->create([
                'account_id' => $account->id,
                'owner_user_id' => $user->id,
                'name' => "Merchant {$position}",
                'created_at' => now()->subDays($position),
            ]);
            $merchant->users()->attach($user->id, ['role' => 'owner']);

            return $merchant;
        })->values();

        return [$user, ...$merchants->all()];
    }

    private function authenticated(User $user): self
    {
        return $this->withToken($user->createToken('test-suite')->plainTextToken);
    }
}
