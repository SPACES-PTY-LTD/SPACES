<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use App\Services\VehicleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class VehicleServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_update_vehicle_sets_location_updated_at_when_last_location_address_changes(): void
    {
        Carbon::setTestNow('2026-02-16 12:00:00');

        $user = User::factory()->create(['role' => 'user']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->account_id = $account->id;
        $user->save();

        $vehicle = Vehicle::create([
            'account_id' => $account->id,
            'plate_number' => 'CA12345',
            'last_location_address' => ['address_line_1' => 'Old Address'],
            'location_updated_at' => null,
        ]);

        $updated = app(VehicleService::class)->updateVehicle($user, $vehicle->uuid, [
            'last_location_address' => ['address_line_1' => 'New Address'],
        ]);

        $this->assertSame('New Address', $updated->last_location_address['address_line_1']);
        $this->assertSame('2026-02-16T12:00:00+00:00', $updated->location_updated_at?->toIso8601String());

        Carbon::setTestNow();
    }

    public function test_update_vehicle_keeps_explicit_location_updated_at_when_provided(): void
    {
        Carbon::setTestNow('2026-02-16 12:00:00');

        $user = User::factory()->create(['role' => 'user']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->account_id = $account->id;
        $user->save();

        $vehicle = Vehicle::create([
            'account_id' => $account->id,
            'plate_number' => 'CA54321',
            'last_location_address' => ['address_line_1' => 'Old Address'],
            'location_updated_at' => null,
        ]);

        $updated = app(VehicleService::class)->updateVehicle($user, $vehicle->uuid, [
            'last_location_address' => ['address_line_1' => 'New Address'],
            'location_updated_at' => '2026-02-10 08:30:00',
        ]);

        $this->assertSame('New Address', $updated->last_location_address['address_line_1']);
        $this->assertSame('2026-02-10T08:30:00+00:00', $updated->location_updated_at?->toIso8601String());

        Carbon::setTestNow();
    }

    public function test_fleet_status_summary_uses_location_transition_monitoring_logic(): void
    {
        Carbon::setTestNow('2026-07-24 12:00:00');

        $user = User::factory()->create(['role' => 'user']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();
        $merchant = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
            'status' => 'active',
        ]);
        $location = Location::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'name' => 'Fleet Depot',
            'code' => 'FLEET-DEPOT',
            'address_line_1' => '1 Fleet Road',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
        ]);

        $makeVehicle = function (string $plate, bool $maintenance = false) use ($account, $merchant): Vehicle {
            return Vehicle::create([
                'account_id' => $account->id,
                'merchant_id' => $merchant->id,
                'plate_number' => $plate,
                'maintenance_mode_at' => $maintenance ? now() : null,
                'is_active' => true,
            ]);
        };
        $recordTransition = function (Vehicle $vehicle, string $eventType, Carbon $occurredAt) use ($account, $merchant, $location): void {
            VehicleActivity::create([
                'account_id' => $account->id,
                'merchant_id' => $merchant->id,
                'vehicle_id' => $vehicle->id,
                'location_id' => $location->id,
                'event_type' => $eventType,
                'occurred_at' => $occurredAt,
                'entered_at' => $eventType === VehicleActivity::EVENT_ENTERED_LOCATION ? $occurredAt : null,
                'exited_at' => $eventType === VehicleActivity::EVENT_EXITED_LOCATION ? $occurredAt : null,
            ]);
        };

        $atLocation = $makeVehicle('AT-LOCATION');
        $recordTransition($atLocation, VehicleActivity::EVENT_ENTERED_LOCATION, now()->subHours(2));
        $standby = $makeVehicle('STANDBY');
        $recordTransition($standby, VehicleActivity::EVENT_ENTERED_LOCATION, now()->subHours(48));
        $inTransit = $makeVehicle('IN-TRANSIT', true);
        $recordTransition($inTransit, VehicleActivity::EVENT_EXITED_LOCATION, now()->subHours(72));
        $makeVehicle('UNKNOWN');

        $summary = app(VehicleService::class)->buildFleetStatusSummary($user, [
            'merchant_id' => $merchant->uuid,
        ]);

        $this->assertSame(1, $summary['at_location']);
        $this->assertSame(1, $summary['in_transit']);
        $this->assertSame(1, $summary['standby']);
        $this->assertSame(1, $summary['unknown']);
        $this->assertSame($summary['in_transit'], $summary['active']);
        $this->assertSame(1, $summary['maintenance']);
        $this->assertSame(4, $summary['total']);

        Carbon::setTestNow();
    }
}
