<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class DataPurgeControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['queue.default' => 'database']);
        \Illuminate\Support\Facades\Queue::fake();
    }

    private function queueAndRun(User $user, Merchant $merchant, array $types)
    {
        $response = $this->withToken($user->createToken('test-suite')->plainTextToken)
            ->postJson("/api/v1/merchants/{$merchant->uuid}/purge-data", [
                'merchant_id' => $merchant->uuid, 'password' => 'password', 'types' => $types,
            ])->assertAccepted()->assertJsonPath('data.status', 'queued');
        $purge = \App\Models\DataPurge::where('uuid', $response->json('data.job_id'))->firstOrFail();
        $job = new \App\Jobs\PurgeMerchantDataJob($purge->id);
        try {
            $job->handle(app(\App\Services\DataPurgeService::class));
        } catch (\Throwable $e) {
            $job->failed($e);
        }

        return $this->getJson("/api/v1/merchants/{$merchant->uuid}/purge-data/{$purge->uuid}");
    }

    public function test_shipment_purge_deletes_tracking_events_in_bounded_primary_key_batches(): void
    {
        $user = User::factory()->create(['password' => 'password']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->update(['account_id' => $account->id]);
        $merchant = Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $user->id]);
        $otherMerchant = Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $user->id]);
        $shipments = [];
        foreach ([$merchant, $otherMerchant] as $owner) {
            $shipments[] = Shipment::create([
                'merchant_id' => $owner->id,
                'merchant_order_ref' => 'purge-test',
                'status' => 'draft',
                'pickup_address' => [],
                'dropoff_address' => [],
            ]);
        }
        foreach ($shipments as $shipment) {
            $events = [];
            for ($i = 0; $i < 501; $i++) {
                $events[] = [
                    'uuid' => (string) Str::uuid(),
                    'merchant_id' => $shipment->merchant_id,
                    'shipment_id' => $shipment->id,
                    'event_code' => 'created',
                    'occurred_at' => now(),
                    'deleted_at' => $i % 2 ? now() : null,
                ];
            }
            DB::table('tracking_events')->insert($events);
        }
        $deletes = [];
        DB::listen(function ($query) use (&$deletes) {
            if (str_starts_with($query->sql, 'delete from "tracking_events"')) {
                $deletes[] = $query;
            }
        });

        $this->queueAndRun($user, $merchant, ['shipments'])
            ->assertOk()
            ->assertJsonPath('data.result.results.shipments.tables.tracking_events', 501)
            ->assertJsonPath('data.result.results.shipments.tables.shipments', 1);

        $this->assertCount(3, $deletes);
        foreach ($deletes as $query) {
            $this->assertStringContainsString('where "id" in', $query->sql);
            $this->assertLessThanOrEqual(250, count($query->bindings));
        }
        $this->assertDatabaseMissing('shipments', ['id' => $shipments[0]->id]);
        $this->assertDatabaseHas('shipments', ['id' => $shipments[1]->id]);
        $this->assertSame(501, DB::table('tracking_events')->where('merchant_id', $otherMerchant->id)->count());
    }

    public function test_exhausted_lock_retries_are_reported_by_job_status(): void
    {
        $user = User::factory()->create(['password' => 'password']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->update(['account_id' => $account->id]);
        $merchant = Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $user->id]);
        $this->mock(\App\Services\DataPurgeService::class)
            ->shouldReceive('purge')->once()
            ->andThrow(new \RuntimeException('Lock wait timeout exceeded; try restarting transaction'));

        $this->queueAndRun($user, $merchant, ['shipments'])
            ->assertOk()
            ->assertJsonPath('data.status', 'failed')
            ->assertJsonPath('data.error_message', 'Deletion could not acquire database locks. No database changes were committed. Try again when other updates have finished.');
    }

    public function test_it_can_purge_vehicle_activity_without_deleting_vehicles(): void
    {
        $user = User::factory()->create(['password' => 'password']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->update(['account_id' => $account->id]);

        $merchant = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
        ]);

        $vehicle = Vehicle::create([
            'account_id' => $account->id,
            'make' => 'Ford',
            'model' => 'Transit',
            'plate_number' => 'CA 123 456',
        ]);

        $otherUser = User::factory()->create();
        $otherAccount = Account::create(['owner_user_id' => $otherUser->id]);
        $otherUser->update(['account_id' => $otherAccount->id]);

        $otherMerchant = Merchant::factory()->create([
            'account_id' => $otherAccount->id,
            'owner_user_id' => $otherUser->id,
        ]);

        $otherVehicle = Vehicle::create([
            'account_id' => $otherAccount->id,
            'make' => 'Toyota',
            'model' => 'Hilux',
            'plate_number' => 'GP 654 321',
        ]);

        $merchantActivity = VehicleActivity::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicle->id,
            'event_type' => VehicleActivity::EVENT_MOVING,
            'occurred_at' => now(),
        ]);

        $otherMerchantActivity = VehicleActivity::create([
            'account_id' => $otherAccount->id,
            'merchant_id' => $otherMerchant->id,
            'vehicle_id' => $otherVehicle->id,
            'event_type' => VehicleActivity::EVENT_STOPPED,
            'occurred_at' => now(),
        ]);

        $response = $this->queueAndRun($user, $merchant, ['vehicle_activity']);

        $response->assertOk()
            ->assertJsonPath('data.result.processed_types.0', 'vehicle_activity')
            ->assertJsonPath('data.result.results.vehicle_activity.tables.vehicle_activity', 1);

        $this->assertDatabaseMissing('vehicle_activity', ['id' => $merchantActivity->id]);
        $this->assertDatabaseHas('vehicle_activity', ['id' => $otherMerchantActivity->id]);
        $this->assertDatabaseHas('vehicles', ['id' => $vehicle->id]);
    }

    public function test_it_can_purge_unassigned_vehicles_owned_by_the_merchant(): void
    {
        $user = User::factory()->create(['password' => 'password']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->update(['account_id' => $account->id]);

        $merchant = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
        ]);

        $vehicle = Vehicle::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'make' => 'Ford',
            'model' => 'Transit',
            'plate_number' => 'CA 123 456',
        ]);

        $otherUser = User::factory()->create();
        $otherAccount = Account::create(['owner_user_id' => $otherUser->id]);
        $otherUser->update(['account_id' => $otherAccount->id]);

        $otherMerchant = Merchant::factory()->create([
            'account_id' => $otherAccount->id,
            'owner_user_id' => $otherUser->id,
        ]);

        $otherVehicle = Vehicle::create([
            'account_id' => $otherAccount->id,
            'merchant_id' => $otherMerchant->id,
            'make' => 'Toyota',
            'model' => 'Hilux',
            'plate_number' => 'GP 654 321',
        ]);

        $response = $this->queueAndRun($user, $merchant, ['vehicles']);

        $response->assertOk()
            ->assertJsonPath('data.result.processed_types.0', 'vehicles')
            ->assertJsonPath('data.result.results.vehicles.tables.vehicles', 1);

        $this->assertDatabaseMissing('vehicles', ['id' => $vehicle->id]);
        $this->assertDatabaseHas('vehicles', ['id' => $otherVehicle->id]);
    }
}
