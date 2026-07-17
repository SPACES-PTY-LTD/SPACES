<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Driver;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class VehicleLatestActivityCheckTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_returns_all_merchant_vehicles_with_latest_activity_data(): void
    {
        $user = User::withoutEvents(fn () => User::factory()->create(['role' => 'user']));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();

        $merchant = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
            'name' => 'Northwind',
            'status' => 'active',
        ]);

        $otherMerchant = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
            'name' => 'Other Merchant',
            'status' => 'active',
        ]);

        $vehicleWithActivity = Vehicle::create([
            'account_id' => $account->id,
            'plate_number' => 'CA 123',
            'ref_code' => 'VH-1',
            'make' => 'Toyota',
            'model' => 'Hilux',
            'driver_logged_at' => Carbon::parse('2026-02-28 10:05:00'),
            'is_active' => true,
        ]);

        $vehicleWithoutActivity = Vehicle::create([
            'account_id' => $account->id,
            'plate_number' => 'CA 456',
            'ref_code' => 'VH-2',
            'make' => 'Ford',
            'model' => 'Ranger',
            'is_active' => false,
        ]);

        $driverUser = User::withoutEvents(fn () => User::factory()->create([
            'role' => 'driver',
            'account_id' => $account->id,
            'name' => 'Driver One',
            'email' => 'driver@example.com',
            'telephone' => '+15550001',
        ]));

        $driver = Driver::create([
            'account_id' => $account->id,
            'user_id' => $driverUser->id,
            'intergration_id' => 'DRV-1',
            'is_active' => true,
        ]);

        $location = Location::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'name' => 'Cape Town Depot',
            'company' => 'Northwind Depot',
            'code' => 'CTD',
            'full_address' => '123 Long Street',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'country' => 'ZA',
        ]);

        $shipment = Shipment::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'ORD-100',
            'status' => 'draft',
            'auto_created' => true,
        ]);

        $run = Run::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicleWithActivity->id,
            'status' => Run::STATUS_IN_PROGRESS,
        ]);
        RunShipment::create([
            'run_id' => $run->id,
            'shipment_id' => $shipment->id,
            'status' => RunShipment::STATUS_ACTIVE,
        ]);

        VehicleActivity::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicleWithActivity->id,
            'event_type' => VehicleActivity::EVENT_MOVING,
            'occurred_at' => '2026-02-28 09:00:00',
            'latitude' => 1.1,
            'longitude' => 2.2,
        ]);

        $latestActivity = VehicleActivity::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicleWithActivity->id,
            'location_id' => $location->id,
            'run_id' => $run->id,
            'shipment_id' => $shipment->id,
            'event_type' => VehicleActivity::EVENT_ENTERED_LOCATION,
            'occurred_at' => '2026-02-28 10:00:00',
            'entered_at' => '2026-02-28 10:01:00',
            'latitude' => -33.9249,
            'longitude' => 18.4241,
            'speed_kph' => 45.5,
            'speed_limit_kph' => 60,
            'metadata' => ['source' => 'test'],
        ]);

        $vehicleWithActivity->forceFill(['last_driver_id' => $driver->id])->save();

        VehicleActivity::create([
            'account_id' => $account->id,
            'merchant_id' => $otherMerchant->id,
            'vehicle_id' => $vehicleWithoutActivity->id,
            'event_type' => VehicleActivity::EVENT_MOVING,
            'occurred_at' => '2026-02-28 11:00:00',
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/v1/vehicles/latest-activity-check?merchant_id=' . $merchant->uuid);

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.vehicle.vehicle_id', $vehicleWithoutActivity->uuid)
            ->assertJsonPath('data.0.activity_id', null)
            ->assertJsonPath('data.0.location', null)
            ->assertJsonPath('data.0.merchant.merchant_id', $merchant->uuid)
            ->assertJsonPath('data.0.vehicle.last_driver_id', null)
            ->assertJsonPath('data.0.vehicle.fleet_status', 'standby')
            ->assertJsonPath('data.1.vehicle.vehicle_id', $vehicleWithActivity->uuid)
            ->assertJsonPath('data.1.activity_id', $latestActivity->uuid)
            ->assertJsonPath('data.1.merchant.merchant_id', $merchant->uuid)
            ->assertJsonPath('data.1.location.location_id', $location->uuid)
            ->assertJsonPath('data.1.run_id', $run->uuid)
            ->assertJsonPath('data.1.vehicle.last_driver_id', $driver->uuid)
            ->assertJsonPath('data.1.vehicle.last_driver.driver_id', $driver->uuid)
            ->assertJsonPath('data.1.vehicle.fleet_status', 'active')
            ->assertJsonPath('data.1.vehicle.driver_logged_at', '2026-02-28T10:05:00+00:00')
            ->assertJsonPath('data.1.driver.driver_id', $driver->uuid)
            ->assertJsonPath('data.1.shipment.shipment_id', $shipment->uuid)
            ->assertJsonPath('data.1.event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
            ->assertJsonPath('data.1.metadata.source', 'test');
    }

    public function test_it_classifies_maintenance_and_non_qualifying_runs_outside_active_status(): void
    {
        $user = User::withoutEvents(fn () => User::factory()->create(['role' => 'user']));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();
        $merchant = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
            'status' => 'active',
        ]);

        $maintenanceVehicle = Vehicle::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => 'MAINT-1',
            'maintenance_mode_at' => now(),
            'is_active' => true,
        ]);
        $deliveredVehicle = Vehicle::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => 'DONE-1',
            'is_active' => true,
        ]);
        $removedVehicle = Vehicle::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => 'REMOVED-1',
            'is_active' => true,
        ]);

        foreach ([
            [$deliveredVehicle, 'delivered', RunShipment::STATUS_DONE],
            [$removedVehicle, 'draft', RunShipment::STATUS_REMOVED],
        ] as [$vehicle, $shipmentStatus, $runShipmentStatus]) {
            $shipment = Shipment::create([
                'account_id' => $account->id,
                'merchant_id' => $merchant->id,
                'merchant_order_ref' => 'ORDER-'.$vehicle->id,
                'status' => $shipmentStatus,
            ]);
            $run = Run::create([
                'account_id' => $account->id,
                'merchant_id' => $merchant->id,
                'vehicle_id' => $vehicle->id,
                'status' => Run::STATUS_IN_PROGRESS,
            ]);
            RunShipment::create([
                'run_id' => $run->id,
                'shipment_id' => $shipment->id,
                'status' => $runShipmentStatus,
            ]);
        }

        $response = $this->actingAs($user)
            ->getJson('/api/v1/vehicles/latest-activity-check?merchant_id='.$merchant->uuid);

        $response->assertOk();
        $statusesByPlate = collect($response->json('data'))
            ->mapWithKeys(fn (array $item) => [$item['vehicle']['plate_number'] => $item['vehicle']['fleet_status']]);

        $this->assertSame('maintenance', $statusesByPlate->get($maintenanceVehicle->plate_number));
        $this->assertSame('standby', $statusesByPlate->get($deliveredVehicle->plate_number));
        $this->assertSame('standby', $statusesByPlate->get($removedVehicle->plate_number));
    }

    public function test_it_requires_merchant_id(): void
    {
        $user = User::withoutEvents(fn () => User::factory()->create(['role' => 'user']));

        $response = $this->actingAs($user)
            ->getJson('/api/v1/vehicles/latest-activity-check');

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION');
    }
}
