<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ShipmentRunEndTimelineTest extends TestCase
{
    use RefreshDatabase;

    public static function endScenarios(): array
    {
        return [
            'different saved location' => ['different', true],
            'same delivery location' => ['same', false],
            'already linked end is deduplicated' => ['linked', true],
            'removed assignment' => ['removed', false],
            'unrelated run on same vehicle' => ['unrelated', false],
            'different merchant' => ['merchant', false],
            'wrong vehicle' => ['vehicle', false],
            'GPS-only end' => ['gps', true],
            'no recorded location' => ['unknown', false],
            'planned destination without end observation' => ['planned', false],
        ];
    }

    #[DataProvider('endScenarios')]
    public function test_shipment_timeline_uses_only_eligible_recorded_run_ends(string $scenario, bool $visible): void
    {
        $user = User::factory()->create();
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();
        $merchant = Merchant::factory()->create(['owner_user_id' => $user->id, 'account_id' => $user->account_id]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);
        $location = Location::create(['account_id' => $user->account_id, 'merchant_id' => $merchant->id, 'name' => 'Delivery', 'address_line_1' => '1 Main Road', 'city' => 'Cape Town', 'province' => 'Western Cape', 'post_code' => '8001']);
        // Identical names must not make two different saved locations equal.
        $endLocation = Location::create(['account_id' => $user->account_id, 'merchant_id' => $merchant->id, 'name' => 'Delivery', 'address_line_1' => '1 Main Road', 'city' => 'Cape Town', 'province' => 'Western Cape', 'post_code' => '8001']);
        $vehicle = Vehicle::create(['account_id' => $user->account_id, 'plate_number' => 'RUN-END', 'is_active' => true]);
        $shipment = Shipment::create([
            'account_id' => $user->account_id, 'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'TIMELINE', 'status' => 'delivered',
            'dropoff_location_id' => $location->id,
        ]);
        $run = Run::create([
            'account_id' => $user->account_id, 'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicle->id, 'status' => Run::STATUS_COMPLETED,
            'destination_location_id' => $endLocation->id, 'completed_at' => '2026-10-10 16:00:00',
        ]);
        if ($scenario !== 'unrelated') {
            RunShipment::create([
                'run_id' => $run->id, 'shipment_id' => $shipment->id,
                'status' => $scenario === 'removed' ? RunShipment::STATUS_REMOVED : RunShipment::STATUS_DONE,
            ]);
        }
        $delivery = VehicleActivity::create([
            'account_id' => $user->account_id, 'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicle->id, 'shipment_id' => $shipment->id, 'run_id' => $run->id,
            'location_id' => $location->id, 'event_type' => VehicleActivity::EVENT_SHIPMENT_DELIVERY,
            'occurred_at' => '2026-10-10 14:00:00',
        ]);
        $end = null;
        if ($scenario !== 'planned') {
            $end = VehicleActivity::create([
                'account_id' => $user->account_id,
                'merchant_id' => $scenario === 'merchant' ? Merchant::factory()->create()->id : $merchant->id,
                'vehicle_id' => $scenario === 'vehicle'
                    ? Vehicle::create(['plate_number' => 'OTHER', 'is_active' => true])->id : $vehicle->id,
                'shipment_id' => $scenario === 'linked' ? $shipment->id : null,
                'run_id' => $run->id,
                'location_id' => in_array($scenario, ['gps', 'unknown']) ? null
                    : ($scenario === 'same' ? $location->id : $endLocation->id),
                'latitude' => $scenario === 'gps' ? -26.1 : null,
                'longitude' => $scenario === 'gps' ? 28.1 : null,
                'event_type' => VehicleActivity::EVENT_RUN_ENDED, 'occurred_at' => '2026-10-10 16:00:00',
            ]);
        }

        $response = $this->withHeader('Authorization', 'Bearer '.$user->createToken('test')->plainTextToken)
            ->getJson("/api/v1/shipments/{$shipment->uuid}");
        $response->assertOk()->assertJsonCount($visible ? 2 : 1, 'data.stops')
            ->assertJsonPath('data.stops.0.activity_id', $delivery->uuid);
        if ($visible) {
            $response->assertJsonPath('data.stops.1.activity_id', $end->uuid)
                ->assertJsonPath('data.stops.1.event_type', 'run_ended')
                ->assertJsonPath('data.stops.1.run_id', $run->uuid);
        }
    }
}
