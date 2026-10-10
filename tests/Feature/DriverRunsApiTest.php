<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Driver;
use App\Models\EntityFile;
use App\Models\FileType;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DriverRunsApiTest extends TestCase
{
    use RefreshDatabase;

    private function context(): array
    {
        $owner = User::factory()->create(['role' => 'user']);
        $account = Account::create(['owner_user_id' => $owner->id]);
        $owner->update(['account_id' => $account->id]);
        $merchant = Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $owner->id]);
        $user = User::factory()->create(['role' => 'driver', 'account_id' => $account->id]);
        $driver = Driver::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'user_id' => $user->id, 'is_active' => true]);

        return [$user, $driver, $merchant];
    }

    private function headers(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('runs-test')->plainTextToken];
    }

    private function makeRun(Driver $driver, string $status, array $extra = []): Run
    {
        return Run::create(array_merge(['driver_id' => $driver->id, 'account_id' => $driver->account_id, 'merchant_id' => $driver->merchant_id, 'status' => $status], $extra));
    }

    private function attach(Run $run, string $status = 'booked', string $assignmentStatus = 'planned', array $extra = []): Shipment
    {
        $shipment = Shipment::create(array_merge(['account_id' => $run->account_id, 'merchant_id' => $run->merchant_id, 'status' => $status, 'merchant_order_ref' => (string) \Illuminate\Support\Str::uuid()], $extra));
        RunShipment::create(['run_id' => $run->id, 'shipment_id' => $shipment->id, 'status' => $assignmentStatus, 'sequence' => 1]);

        return $shipment;
    }

    public function test_active_grouping_pagination_and_pending_closure(): void
    {
        [$user, $driver] = $this->context();
        $draft = $this->makeRun($driver, 'draft');
        $ready = $this->makeRun($driver, 'dispatched');
        $active = $this->makeRun($driver, 'in_progress', ['started_at' => now()]);
        $this->attach($active, 'delivered', 'done');
        $this->makeRun($driver, 'completed', ['completed_at' => now()]);
        $this->makeRun($driver, 'cancelled');
        $headers = $this->headers($user);
        $this->postJson("/api/v1/driver/runs/{$active->uuid}/end-requests", ['reason' => 'All done'], $headers)->assertCreated();
        $this->getJson('/api/v1/driver/runs?per_page=2', $headers)->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 3)->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('data.0.run_id', $active->uuid)->assertJsonPath('data.0.end_request.status', 'pending')
            ->assertJsonPath('data.0.delivered_count', 1)->assertJsonPath('data.0.remaining_count', 0)
            ->assertJsonPath('data.1.run_id', $ready->uuid)->assertJsonMissingPath('data.0.shipments')->assertJsonMissingPath('data.0.recorded_stops');
        $this->getJson('/api/v1/driver/runs?per_page=2&page=2', $headers)->assertOk()->assertJsonPath('data.0.run_id', $draft->uuid);
        $this->getJson('/api/v1/driver/runs?status=bad', $headers)->assertUnprocessable();
        $this->getJson('/api/v1/driver/runs?per_page=0', $headers)->assertUnprocessable();
    }

    public function test_completed_ordering_and_empty_runs(): void
    {
        [$user, $driver] = $this->context();
        $old = $this->makeRun($driver, 'completed', ['completed_at' => now()->subDays(2)]);
        $new = $this->makeRun($driver, 'completed', ['completed_at' => now()]);
        $this->makeRun($driver, 'cancelled');
        $headers = $this->headers($user);
        $this->getJson('/api/v1/driver/runs?status=completed', $headers)->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.run_id', $new->uuid)->assertJsonPath('data.1.run_id', $old->uuid);
        $this->getJson("/api/v1/driver/runs/{$new->uuid}", $headers)->assertOk()->assertJsonPath('data.shipment_count', 0)
            ->assertJsonCount(0, 'data.shipments')->assertJsonCount(0, 'data.recorded_stops');
    }

    public function test_list_and_detail_isolate_driver_account_and_merchant(): void
    {
        [$user, $driver, $merchant] = $this->context();
        [, $otherDriver, $otherMerchant] = $this->context();
        $own = $this->makeRun($driver, 'draft');
        $foreign = [
            $this->makeRun($otherDriver, 'draft'),
            $this->makeRun($driver, 'draft', ['merchant_id' => $otherMerchant->id]),
            $this->makeRun($driver, 'draft', ['account_id' => $otherMerchant->account_id]),
        ];
        $headers = $this->headers($user);
        $this->getJson('/api/v1/driver/runs', $headers)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.run_id', $own->uuid);
        foreach ($foreign as $run) {
            $this->getJson("/api/v1/driver/runs/{$run->uuid}", $headers)->assertNotFound();
        }
        $this->getJson('/api/v1/driver/runs')->assertUnauthorized();
        $driver->update(['is_active' => false]);
        $this->getJson('/api/v1/driver/runs', $headers)->assertForbidden();
    }

    public function test_detail_excludes_removed_deleted_and_foreign_shipments_and_groups_visits(): void
    {
        [$user, $driver] = $this->context();
        [, , $foreignMerchant] = $this->context();
        $location = Location::create(['account_id' => $driver->account_id, 'merchant_id' => $driver->merchant_id, 'name' => 'Depot', 'address_line_1' => '1 Test Road', 'city' => 'Johannesburg', 'province' => 'Gauteng', 'post_code' => '2000']);
        $run = $this->makeRun($driver, 'in_progress', ['origin_location_id' => $location->id]);
        $shipment = $this->attach($run, 'delivered', 'done', ['pickup_location_id' => $location->id]);
        $this->attach($run, 'booked', 'removed');
        $this->attach($run)->delete();
        $this->attach($run, 'booked', 'planned', ['merchant_id' => $foreignMerchant->id]);
        $vehicle = Vehicle::create(['account_id' => $run->account_id, 'merchant_id' => $run->merchant_id, 'plate_number' => 'TEST001', 'is_active' => true]);
        $arrival = now()->subHour();
        foreach (['entered_location', 'shipment_collection'] as $type) {
            VehicleActivity::create(['vehicle_id' => $vehicle->id, 'account_id' => $run->account_id, 'merchant_id' => $run->merchant_id, 'run_id' => $run->id, 'location_id' => $location->id, 'shipment_id' => $shipment->id, 'event_type' => $type, 'occurred_at' => $arrival, 'entered_at' => $arrival]);
        }
        VehicleActivity::create(['vehicle_id' => $vehicle->id, 'account_id' => $foreignMerchant->account_id, 'merchant_id' => $foreignMerchant->id, 'run_id' => $run->id, 'event_type' => 'speeding', 'occurred_at' => now()]);
        $headers = $this->headers($user);
        $detail = $this->getJson("/api/v1/driver/runs/{$run->uuid}", $headers)->assertOk()->assertJsonPath('data.shipment_count', 1)
            ->assertJsonCount(1, 'data.shipments')->assertJsonCount(1, 'data.recorded_stops')->assertJsonPath('data.recorded_stops.0.kind', 'Collection');
        $dashboard = $this->getJson('/api/v1/driver/dashboard', $headers)->assertOk();
        $this->assertEquals($dashboard->json('data.recorded_stops'), $detail->json('data.recorded_stops'));
    }

    public function test_completed_shipment_history_survives_reassignment_without_granting_mutation_access(): void
    {
        [$user, $driver] = $this->context();
        $run = $this->makeRun($driver, 'completed', ['completed_at' => now()]);
        $shipment = $this->attach($run, 'delivered', 'done');
        $otherUser = User::factory()->create(['role' => 'driver', 'account_id' => $driver->account_id]);
        $other = Driver::create(['account_id' => $driver->account_id, 'merchant_id' => $driver->merchant_id, 'user_id' => $otherUser->id, 'is_active' => true]);
        $otherRun = $this->makeRun($other, 'in_progress');
        RunShipment::create(['run_id' => $otherRun->id, 'shipment_id' => $shipment->id, 'status' => 'active']);
        $headers = $this->headers($user);
        $url = "/api/v1/driver/shipments/{$shipment->uuid}";
        $this->getJson("$url?run_id={$run->uuid}", $headers)->assertOk()->assertJsonPath('data.run_id', $run->uuid)->assertJsonPath('data.driver.driver_id', $driver->uuid);
        $this->getJson("$url?run_id={$otherRun->uuid}", $headers)->assertNotFound();
        $this->getJson($url, $headers)->assertNotFound();
        $this->patchJson("$url/status?run_id={$run->uuid}", ['status' => 'delivered'], $headers)->assertNotFound();
        $this->getJson("/api/v1/driver/runs/{$run->uuid}", $headers)->assertOk()->assertJsonPath('data.shipments.0.run_id', $run->uuid);
    }

    public function test_run_detail_delivery_note_availability_matches_scoped_run_uploads(): void
    {
        [$user, $driver] = $this->context();
        $run = $this->makeRun($driver, 'in_progress');
        $otherRun = $this->makeRun($driver, 'in_progress');
        $headers = $this->headers($user);
        $url = "/api/v1/driver/runs/{$run->uuid}";
        $this->getJson($url, $headers)->assertOk()->assertJsonPath('data.has_delivery_note', false);
        $note = \App\Models\DeliveryNoteImport::create([
            'account_id' => $driver->account_id, 'merchant_id' => $driver->merchant_id,
            'environment_id' => $run->environment_id, 'run_id' => $otherRun->id,
            'uploaded_by_user_id' => $user->id, 'status' => 'confirmed', 'disk' => 'local',
            'path' => 'test/note.pdf', 'original_name' => 'note.pdf', 'mime_type' => 'application/pdf', 'size_bytes' => 10,
        ]);
        $this->getJson($url, $headers)->assertOk()->assertJsonPath('data.has_delivery_note', false);
        $note->update(['run_id' => $run->id]);
        $this->getJson($url, $headers)->assertOk()->assertJsonPath('data.has_delivery_note', true);
        [, $otherDriver] = $this->context();
        $note->update(['account_id' => $otherDriver->account_id, 'merchant_id' => $otherDriver->merchant_id]);
        $this->getJson($url, $headers)->assertOk()->assertJsonPath('data.has_delivery_note', false);
    }

    public function test_completed_shipment_files_require_owned_retained_run_membership(): void
    {
        [$user, $driver] = $this->context();
        $run = $this->makeRun($driver, 'completed', ['completed_at' => now()]);
        $shipment = $this->attach($run, 'delivered', 'done');
        $type = FileType::create(['account_id' => $driver->account_id, 'merchant_id' => $driver->merchant_id, 'entity_type' => 'shipment', 'name' => 'Proof', 'slug' => 'proof', 'is_active' => true]);
        \Illuminate\Support\Facades\Storage::fake('local');
        \Illuminate\Support\Facades\Storage::disk('local')->put('history/proof.txt', 'Proof');
        $file = EntityFile::create(['account_id' => $driver->account_id, 'merchant_id' => $driver->merchant_id, 'file_type_id' => $type->id, 'attachable_type' => Shipment::class, 'attachable_id' => $shipment->id, 'uploaded_by_user_id' => $user->id, 'uploaded_by_role' => 'driver', 'disk' => 'local', 'path' => 'history/proof.txt', 'original_name' => 'proof.txt', 'mime_type' => 'text/plain', 'size_bytes' => 5]);
        $headers = $this->headers($user);
        $list = "/api/v1/driver/shipments/{$shipment->uuid}/files?run_id={$run->uuid}";
        $download = "/api/v1/driver/files/{$file->uuid}/download?run_id={$run->uuid}";
        $this->getJson($list, $headers)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson($download.'&format=url', $headers)->assertOk()->assertJsonStructure(['data' => ['url']]);
        [, $other] = $this->context();
        $foreignRun = $this->makeRun($other, 'completed', ['completed_at' => now()]);
        $this->getJson("/api/v1/driver/shipments/{$shipment->uuid}/files?run_id={$foreignRun->uuid}", $headers)->assertNotFound();
        $this->getJson("/api/v1/driver/files/{$file->uuid}/download?run_id={$foreignRun->uuid}", $headers)->assertNotFound();
        RunShipment::where('run_id', $run->id)->update(['status' => 'removed']);
        $this->getJson($list, $headers)->assertNotFound();
        $this->getJson($download, $headers)->assertNotFound();
    }

    public function test_card_current_location_requires_recent_scoped_evidence_for_the_active_run(): void
    {
        $this->freezeTime();
        [$user, $driver] = $this->context();
        [, $foreignDriver, $foreignMerchant] = $this->context();
        $vehicle = Vehicle::create(['account_id' => $driver->account_id, 'merchant_id' => $driver->merchant_id, 'plate_number' => 'CARD001',
            'last_driver_id' => $driver->id, 'last_location_address' => ['name' => 'N3', 'address_line_1' => 'Germiston'], 'location_updated_at' => now(), 'is_active' => true]);
        $run = $this->makeRun($driver, 'in_progress', ['vehicle_id' => $vehicle->id, 'started_at' => now()->subHour()]);
        $headers = $this->headers($user);
        $url = "/api/v1/driver/runs/{$run->uuid}";
        $this->getJson('/api/v1/driver/runs', $headers)->assertOk()->assertJsonPath('data.0.current_location.name', 'N3')
            ->assertJsonPath('data.0.current_location.address', 'Germiston');
        $vehicle->update(['last_location_address' => ['latitude' => -26.15, 'longitude' => 28.04]]);
        $this->getJson($url, $headers)->assertOk()->assertJsonPath('data.current_location.name', '-26.15000, 28.04000');
        foreach ([
            ['location_updated_at' => now()->subMinutes(16)],
            ['location_updated_at' => now()->addMinute()],
            ['location_updated_at' => now()->subHours(2)],
            ['location_updated_at' => now(), 'last_driver_id' => $foreignDriver->id],
            ['last_driver_id' => $driver->id, 'merchant_id' => $foreignMerchant->id],
            ['merchant_id' => $driver->merchant_id, 'account_id' => $foreignMerchant->account_id],
            ['account_id' => $driver->account_id, 'location_updated_at' => null],
            ['location_updated_at' => now(), 'last_location_address' => ['latitude' => 100, 'longitude' => 28]],
        ] as $invalid) {
            $vehicle->update($invalid);
            $this->getJson($url, $headers)->assertOk()->assertJsonPath('data.current_location', null);
        }
        $vehicle->update(['last_location_address' => ['address_line_1' => 'Current truck address'], 'location_updated_at' => now()]);
        foreach (['draft', 'dispatched', 'completed'] as $status) {
            $run->update(['status' => $status]);
            $this->getJson($url, $headers)->assertOk()->assertJsonPath('data.current_location', null);
        }
    }

    public function test_card_finish_requires_a_scoped_run_end_event_at_completion(): void
    {
        $this->freezeTime();
        [$user, $driver] = $this->context();
        [, , $foreignMerchant] = $this->context();
        $location = Location::create(['account_id' => $driver->account_id, 'merchant_id' => $driver->merchant_id, 'name' => 'Finish depot', 'address_line_1' => '1 Test Road', 'city' => 'Johannesburg', 'province' => 'Gauteng', 'post_code' => '2000']);
        $vehicle = Vehicle::create(['account_id' => $driver->account_id, 'merchant_id' => $driver->merchant_id, 'plate_number' => 'CARD002', 'is_active' => true]);
        $run = $this->makeRun($driver, 'completed', ['vehicle_id' => $vehicle->id, 'destination_location_id' => $location->id, 'completed_at' => now()]);
        $headers = $this->headers($user);
        $url = "/api/v1/driver/runs/{$run->uuid}";
        // The planned end and last stop must never become a claimed recorded finish.
        $event = VehicleActivity::create(['account_id' => $driver->account_id, 'merchant_id' => $driver->merchant_id, 'vehicle_id' => $vehicle->id, 'run_id' => $run->id, 'location_id' => $location->id, 'event_type' => 'entered_location', 'occurred_at' => now()]);
        $this->getJson($url, $headers)->assertOk()->assertJsonPath('data.recorded_end', null)->assertJsonPath('data.destination.name', 'Finish depot');
        $event->update(['event_type' => 'run_ended']);
        $this->getJson('/api/v1/driver/runs?status=completed', $headers)->assertOk()->assertJsonPath('data.0.recorded_end.name', 'Finish depot');
        $this->getJson($url, $headers)->assertOk()->assertJsonPath('data.recorded_end.location_id', $location->uuid);
        foreach ([
            ['occurred_at' => now()->subMinute()],
            ['occurred_at' => now()->addMinute()],
            ['occurred_at' => now(), 'merchant_id' => $foreignMerchant->id],
            ['merchant_id' => $driver->merchant_id, 'account_id' => $foreignMerchant->account_id],
        ] as $invalid) {
            $event->update($invalid);
            $this->getJson($url, $headers)->assertOk()->assertJsonPath('data.recorded_end', null);
        }
        $event->update(['account_id' => $driver->account_id]);
        $location->update(['merchant_id' => $foreignMerchant->id]);
        $this->getJson($url, $headers)->assertOk()->assertJsonPath('data.recorded_end', null);
    }

    public function test_history_does_not_change_current_run_selection(): void
    {
        [$user, $driver] = $this->context();
        $active = $this->makeRun($driver, 'in_progress');
        $ready = $this->makeRun($driver, 'draft');
        $closed = $this->makeRun($driver, 'completed', ['completed_at' => now()]);
        $headers = $this->headers($user);
        $this->getJson("/api/v1/driver/runs/{$closed->uuid}", $headers)->assertOk();
        $this->getJson('/api/v1/driver/dashboard', $headers)->assertOk()->assertJsonPath('data.current_run.run_id', $active->uuid);
        $this->getJson("/api/v1/driver/dashboard?run_id={$ready->uuid}", $headers)->assertOk()->assertJsonPath('data.current_run.run_id', $ready->uuid);
    }
}
