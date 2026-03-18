<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Driver;
use App\Models\DriverVehicle;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\Booking;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RunApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_run_lifecycle_allows_attach_dispatch_start_and_complete(): void
    {
        [$user, $merchant, $token] = $this->createMerchantContext();
        $driver = $this->createDriver($merchant);
        $vehicle = $this->createVehicle($merchant);

        $shipmentA = $this->createShipment($merchant, 'ORDER-RUN-1', 'draft');
        $shipmentB = $this->createShipment($merchant, 'ORDER-RUN-2', 'booked');

        $create = $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson('/api/v1/runs', [
                'merchant_id' => $merchant->uuid,
                'driver_id' => $driver->uuid,
                'vehicle_id' => $vehicle->uuid,
                'planned_start_at' => now()->addHour()->toIso8601String(),
                'notes' => 'Morning run',
            ]);

        $create->assertStatus(201)
            ->assertJsonPath('data.status', 'draft');

        $runId = $create->json('data.run_id');

        $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson("/api/v1/runs/{$runId}/shipments", [
                'shipment_ids' => [$shipmentA->uuid, $shipmentB->uuid],
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.shipment_count', 2);

        $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson("/api/v1/runs/{$runId}/dispatch")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'dispatched');

        $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson("/api/v1/runs/{$runId}/start")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'in_progress');

        $shipmentA->update(['status' => 'delivered']);
        $shipmentB->update(['status' => 'failed']);

        $complete = $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson("/api/v1/runs/{$runId}/complete");

        $complete->assertStatus(200)
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.terminal_count', 2);

        $statuses = collect($complete->json('data.shipments'))->pluck('run_status')->sort()->values()->all();
        $this->assertSame(['done', 'failed'], $statuses);

        $shipmentResponse = $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->getJson("/api/v1/shipments/{$shipmentA->uuid}");

        $shipmentResponse->assertStatus(200)
            ->assertJsonPath('data.run_id', null);
    }

    public function test_run_complete_is_blocked_if_any_shipment_is_not_terminal(): void
    {
        [$user, $merchant, $token] = $this->createMerchantContext();
        $driver = $this->createDriver($merchant);
        $vehicle = $this->createVehicle($merchant);
        $shipment = $this->createShipment($merchant, 'ORDER-BLOCK-1', 'booked');

        $runId = $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson('/api/v1/runs', [
                'merchant_id' => $merchant->uuid,
                'driver_id' => $driver->uuid,
                'vehicle_id' => $vehicle->uuid,
            ])
            ->assertStatus(201)
            ->json('data.run_id');

        $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson("/api/v1/runs/{$runId}/shipments", [
                'shipment_ids' => [$shipment->uuid],
            ])
            ->assertStatus(200);

        $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson("/api/v1/runs/{$runId}/start")
            ->assertStatus(200);

        $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson("/api/v1/runs/{$runId}/complete")
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'RUN_CONFLICT');
    }

    public function test_run_attach_rejects_terminal_and_cross_merchant_shipments(): void
    {
        [$user, $merchant, $token] = $this->createMerchantContext();
        [$otherUser, $otherMerchant] = $this->createMerchantContext('other@example.com');

        $runId = $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson('/api/v1/runs', [
                'merchant_id' => $merchant->uuid,
            ])
            ->assertStatus(201)
            ->json('data.run_id');

        $terminalShipment = $this->createShipment($merchant, 'ORDER-TERM-1', 'delivered');

        $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson("/api/v1/runs/{$runId}/shipments", [
                'shipment_ids' => [$terminalShipment->uuid],
            ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION');

        $foreignShipment = $this->createShipment($otherMerchant, 'ORDER-FOREIGN-1', 'booked');

        $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson("/api/v1/runs/{$runId}/shipments", [
                'shipment_ids' => [$foreignShipment->uuid],
            ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION');
    }

    public function test_shipment_assign_driver_creates_new_run_and_returns_shipment_resource(): void
    {
        [$user, $merchant, $token] = $this->createMerchantContext();
        $driver = $this->createDriver($merchant);
        $vehicle = $this->createVehicle($merchant);
        $shipment = $this->createShipment($merchant, 'ORDER-ASSIGN-1', 'draft');

        $response = $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson("/api/v1/shipments/{$shipment->uuid}/assign_driver", [
                'driver_id' => $driver->uuid,
                'vehicle_id' => $vehicle->uuid,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.shipment_id', $shipment->uuid)
            ->assertJsonPath('data.driver.driver_id', $driver->uuid)
            ->assertJsonPath('data.vehicle.vehicle_id', $vehicle->uuid)
            ->assertJsonPath('data.run_status', Run::STATUS_DRAFT)
            ->assertJsonPath('data.run_shipment_status', 'planned');

        $this->assertDatabaseCount('runs', 1);
        $this->assertDatabaseHas('run_shipments', [
            'shipment_id' => $shipment->id,
            'status' => 'planned',
        ]);
        $this->assertDatabaseHas('driver_vehicles', [
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
        ]);
    }

    public function test_shipment_assign_driver_updates_existing_run_driver_and_vehicle(): void
    {
        [$user, $merchant, $token] = $this->createMerchantContext();
        $firstDriver = $this->createDriver($merchant);
        $secondDriver = $this->createDriver($merchant, true);
        $firstVehicle = $this->createVehicle($merchant);
        $secondVehicle = $this->createVehicle($merchant);
        $shipment = $this->createShipment($merchant, 'ORDER-ASSIGN-2', 'draft');

        $run = Run::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'driver_id' => $firstDriver->id,
            'vehicle_id' => $firstVehicle->id,
            'status' => Run::STATUS_DRAFT,
        ]);
        RunShipment::create([
            'run_id' => $run->id,
            'shipment_id' => $shipment->id,
            'status' => 'planned',
        ]);

        $response = $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson("/api/v1/shipments/{$shipment->uuid}/assign_driver", [
                'driver_id' => $secondDriver->uuid,
                'vehicle_id' => $secondVehicle->uuid,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.shipment_id', $shipment->uuid)
            ->assertJsonPath('data.run_id', $run->uuid)
            ->assertJsonPath('data.driver.driver_id', $secondDriver->uuid)
            ->assertJsonPath('data.vehicle.vehicle_id', $secondVehicle->uuid);

        $this->assertDatabaseCount('runs', 1);
        $this->assertDatabaseHas('runs', [
            'id' => $run->id,
            'driver_id' => $secondDriver->id,
            'vehicle_id' => $secondVehicle->id,
        ]);
        $this->assertDatabaseHas('driver_vehicles', [
            'driver_id' => $secondDriver->id,
            'vehicle_id' => $secondVehicle->id,
        ]);
    }

    public function test_run_create_syncs_driver_vehicle_assignment(): void
    {
        [$user, $merchant, $token] = $this->createMerchantContext();
        $driver = $this->createDriver($merchant);
        $vehicle = $this->createVehicle($merchant);

        $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson('/api/v1/runs', [
                'merchant_id' => $merchant->uuid,
                'driver_id' => $driver->uuid,
                'vehicle_id' => $vehicle->uuid,
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('driver_vehicles', [
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
        ]);
        $this->assertSame(1, DriverVehicle::query()->count());
    }

    public function test_run_update_syncs_driver_vehicle_assignment_without_duplicates(): void
    {
        [$user, $merchant, $token] = $this->createMerchantContext();
        $firstDriver = $this->createDriver($merchant);
        $secondDriver = $this->createDriver($merchant, true);
        $firstVehicle = $this->createVehicle($merchant);
        $secondVehicle = $this->createVehicle($merchant);

        $runId = $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson('/api/v1/runs', [
                'merchant_id' => $merchant->uuid,
                'driver_id' => $firstDriver->uuid,
                'vehicle_id' => $firstVehicle->uuid,
            ])
            ->assertStatus(201)
            ->json('data.run_id');

        $this->assertSame(1, DriverVehicle::query()->count());

        $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->patchJson("/api/v1/runs/{$runId}", [
                'driver_id' => $secondDriver->uuid,
                'vehicle_id' => $secondVehicle->uuid,
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('driver_vehicles', [
            'driver_id' => $secondDriver->id,
            'vehicle_id' => $secondVehicle->id,
        ]);
        $this->assertSame(2, DriverVehicle::query()->count());

        $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->patchJson("/api/v1/runs/{$runId}", [
                'driver_id' => $secondDriver->uuid,
                'vehicle_id' => $secondVehicle->uuid,
            ])
            ->assertStatus(200);

        $this->assertSame(2, DriverVehicle::query()->count());
    }

    public function test_run_start_moves_auto_created_booking_to_in_transit_and_syncs_driver(): void
    {
        [$user, $merchant, $token] = $this->createMerchantContext();
        $driver = $this->createDriver($merchant);
        $vehicle = $this->createVehicle($merchant);
        $shipment = $this->createShipment($merchant, 'ORDER-AUTO-1', 'booked', true);

        $booking = Booking::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'shipment_id' => $shipment->id,
            'quote_option_id' => null,
            'status' => 'booked',
            'carrier_code' => 'internal',
            'booked_at' => now()->subMinutes(5),
        ]);

        $runId = $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson('/api/v1/runs', [
                'merchant_id' => $merchant->uuid,
                'driver_id' => $driver->uuid,
                'vehicle_id' => $vehicle->uuid,
            ])
            ->assertStatus(201)
            ->json('data.run_id');

        $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson("/api/v1/runs/{$runId}/shipments", [
                'shipment_ids' => [$shipment->uuid],
            ])
            ->assertStatus(200);

        $this->withHeaders($this->authHeaders($token, $merchant->uuid))
            ->postJson("/api/v1/runs/{$runId}/start")
            ->assertStatus(200);

        $booking->refresh();

        $this->assertSame('in_transit', $booking->status);
        $this->assertSame($driver->id, $booking->current_driver_id);
        $this->assertNotNull($booking->collected_at);
    }

    private function createMerchantContext(?string $email = null): array
    {
        $user = User::withoutEvents(fn () => User::factory()->create([
            'email' => $email ?? fake()->unique()->safeEmail(),
            'role' => 'user',
        ]));

        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();

        $merchant = Merchant::create([
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
            'name' => fake()->company(),
            'legal_name' => fake()->company().' LLC',
            'status' => 'active',
            'billing_email' => fake()->safeEmail(),
            'default_webhook_url' => fake()->url(),
            'timezone' => 'UTC',
            'operating_countries' => ['US'],
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $token = $user->createToken('test')->plainTextToken;

        return [$user, $merchant, $token];
    }

    private function createDriver(Merchant $merchant, bool $setMerchantId = false): Driver
    {
        $driverUser = User::withoutEvents(fn () => User::factory()->create([
            'role' => 'driver',
            'account_id' => $merchant->account_id,
        ]));

        return Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $setMerchantId ? $merchant->id : null,
            'user_id' => $driverUser->id,
            'is_active' => true,
        ]);
    }

    private function createVehicle(Merchant $merchant): Vehicle
    {
        return Vehicle::create([
            'account_id' => $merchant->account_id,
            'plate_number' => strtoupper(fake()->bothify('??-####')),
            'is_active' => true,
        ]);
    }

    private function createShipment(Merchant $merchant, string $orderRef, string $status, bool $autoCreated = false): Shipment
    {
        $pickup = $this->createLocation($merchant, 'Pickup '.$orderRef);
        $dropoff = $this->createLocation($merchant, 'Dropoff '.$orderRef);

        return Shipment::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => $orderRef,
            'status' => $status,
            'pickup_location_id' => $pickup->id,
            'dropoff_location_id' => $dropoff->id,
            'auto_created' => $autoCreated,
        ]);
    }

    private function createLocation(Merchant $merchant, string $name): Location
    {
        return Location::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'name' => $name,
            'address_line_1' => '123 Main St',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
        ]);
    }

    private function authHeaders(string $token, string $merchantUuid): array
    {
        return [
            'Authorization' => 'Bearer '.$token,
            'X-Merchant-Id' => $merchantUuid,
        ];
    }
}
