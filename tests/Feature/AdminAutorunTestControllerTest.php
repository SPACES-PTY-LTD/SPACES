<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use App\Services\AutoRunLifecycleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminAutorunTestControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_process_a_point_location_and_receive_diagnostics(): void
    {
        [$admin, $merchant, $vehicle] = $this->context('super_admin');
        $location = $this->location($merchant, 'Depot', -33.9249, 18.4241);

        $response = $this->withToken($admin->createToken('test-suite')->plainTextToken)->postJson('/api/v1/admin/tools/autorun-test', [
            'merchant_id' => $merchant->uuid,
            'vehicle_id' => $vehicle->uuid,
            'location_id' => $location->uuid,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'processed')
            ->assertJsonPath('data.inside_geofence', true)
            ->assertJsonPath('data.requested_location.location_id', $location->uuid)
            ->assertJsonPath('data.resolved_location.location_id', $location->uuid)
            ->assertJsonPath('data.location_mismatch', false)
            ->assertJsonPath('data.simulated_coordinates.latitude', -33.9249)
            ->assertJsonPath('data.simulated_coordinates.longitude', 18.4241);

        $this->assertDatabaseHas('vehicle_activity', [
            'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicle->id,
            'location_id' => $location->id,
            'event_type' => VehicleActivity::EVENT_ENTERED_LOCATION,
        ]);
    }

    public function test_normal_admin_can_run_the_tool_for_their_account(): void
    {
        [$user, $merchant, $vehicle] = $this->context('user');
        $location = $this->location($merchant, 'Depot', -33.9249, 18.4241);

        $this->withToken($user->createToken('test-suite')->plainTextToken)->postJson('/api/v1/admin/tools/autorun-test', [
            'merchant_id' => $merchant->uuid,
            'vehicle_id' => $vehicle->uuid,
            'location_id' => $location->uuid,
        ])->assertOk()
            ->assertJsonPath('data.requested_location.location_id', $location->uuid);
    }

    public function test_normal_admin_cannot_run_the_tool_for_another_account(): void
    {
        [$user] = $this->context('user');
        [, $merchant, $vehicle] = $this->context('user');
        $location = $this->location($merchant, 'Other depot', -33.9249, 18.4241);

        $this->withToken($user->createToken('test-suite')->plainTextToken)->postJson('/api/v1/admin/tools/autorun-test', [
            'merchant_id' => $merchant->uuid,
            'vehicle_id' => $vehicle->uuid,
            'location_id' => $location->uuid,
        ])->assertForbidden();
    }

    public function test_required_identifiers_are_validated(): void
    {
        [$admin] = $this->context('super_admin');

        $this->withToken($admin->createToken('test-suite')->plainTextToken)->postJson('/api/v1/admin/tools/autorun-test', [])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION');
    }

    public function test_cross_merchant_selections_are_rejected(): void
    {
        [$admin, $merchant, $vehicle] = $this->context('super_admin');
        [, $otherMerchant] = $this->context('user');
        $location = $this->location($otherMerchant, 'Other depot', -33.9249, 18.4241);

        $this->withToken($admin->createToken('test-suite')->plainTextToken)->postJson('/api/v1/admin/tools/autorun-test', [
            'merchant_id' => $merchant->uuid,
            'vehicle_id' => $vehicle->uuid,
            'location_id' => $location->uuid,
        ])->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_polygon_center_is_used_when_point_coordinates_are_missing(): void
    {
        [$admin, $merchant, $vehicle] = $this->context('super_admin');
        $location = Location::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'name' => 'Polygon depot',
            'address_line_1' => '1 Test Street',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
            'polygon_bounds' => 'POLYGON((18.42 -33.93, 18.44 -33.93, 18.44 -33.91, 18.42 -33.91, 18.42 -33.93))',
        ]);

        $this->withToken($admin->createToken('test-suite')->plainTextToken)->postJson('/api/v1/admin/tools/autorun-test', [
            'merchant_id' => $merchant->uuid,
            'vehicle_id' => $vehicle->uuid,
            'location_id' => $location->uuid,
        ])->assertOk()
            ->assertJsonPath('data.simulated_coordinates.latitude', -33.92)
            ->assertJsonPath('data.simulated_coordinates.longitude', 18.43);
    }

    public function test_overlapping_geofences_report_the_location_selected_by_the_normal_resolver(): void
    {
        [$admin, $merchant, $vehicle] = $this->context('super_admin');
        $winner = $this->location($merchant, 'First depot', -33.9249, 18.4241);
        $requested = $this->location($merchant, 'Second depot', -33.9249, 18.4241);

        $this->withToken($admin->createToken('test-suite')->plainTextToken)->postJson('/api/v1/admin/tools/autorun-test', [
            'merchant_id' => $merchant->uuid,
            'vehicle_id' => $vehicle->uuid,
            'location_id' => $requested->uuid,
        ])->assertOk()
            ->assertJsonPath('data.requested_location.location_id', $requested->uuid)
            ->assertJsonPath('data.resolved_location.location_id', $winner->uuid)
            ->assertJsonPath('data.location_mismatch', true);
    }

    public function test_unexpected_failures_return_a_safe_error(): void
    {
        [$admin, $merchant, $vehicle] = $this->context('super_admin');
        $location = $this->location($merchant, 'Depot', -33.9249, 18.4241);
        $this->mock(AutoRunLifecycleService::class)
            ->shouldReceive('processVehiclePosition')
            ->once()
            ->andThrow(new \RuntimeException('sensitive provider detail'));

        $response = $this->withToken($admin->createToken('test-suite')->plainTextToken)->postJson('/api/v1/admin/tools/autorun-test', [
            'merchant_id' => $merchant->uuid,
            'vehicle_id' => $vehicle->uuid,
            'location_id' => $location->uuid,
        ]);

        $response->assertBadRequest()
            ->assertJsonPath('error.code', 'AUTORUN_TEST_FAILED')
            ->assertJsonPath('error.message', 'Unable to process the autorun lifecycle test.')
            ->assertJsonStructure(['error' => ['request_id']]);
        $this->assertStringNotContainsString('sensitive provider detail', $response->getContent());
    }

    private function context(string $role): array
    {
        $user = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'role' => $role,
        ]));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();
        $merchant = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
            'allow_auto_shipment_creations_at_locations' => false,
        ]);
        $vehicle = Vehicle::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => fake()->bothify('CA ####'),
            'is_active' => true,
        ]);

        return [$user, $merchant, $vehicle];
    }

    private function location(Merchant $merchant, string $name, float $latitude, float $longitude): Location
    {
        return Location::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'name' => $name,
            'address_line_1' => '1 Test Street',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
            'latitude' => $latitude,
            'longitude' => $longitude,
            'metadata' => ['geofence_radius_meters' => 150],
        ]);
    }
}
