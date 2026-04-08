<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocationGeofenceUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_location_geofence_update_preserves_api_coordinate_order(): void
    {
        [$user, $merchant, $location] = $this->createLocationContext();

        $polygonBounds = [
            [-29.7241, 31.0663],
            [-29.7241, 31.0683],
            [-29.7261, 31.0683],
            [-29.7261, 31.0663],
        ];

        $response = $this->withHeader('Authorization', 'Bearer '.$user->createToken('test-suite')->plainTextToken)
            ->patchJson("/api/v1/locations/{$location->uuid}", [
                'name' => 'Durban Depot',
                'polygon_bounds' => $polygonBounds,
            ]);

        $response->assertOk()
            ->assertJsonPath('data.location_id', $location->uuid)
            ->assertJsonPath('data.polygon_bounds', [
                ...$polygonBounds,
                $polygonBounds[0],
            ]);

        $this->assertSame(
            'POLYGON((31.0663 -29.7241, 31.0683 -29.7241, 31.0683 -29.7261, 31.0663 -29.7261, 31.0663 -29.7241))',
            $location->fresh()->polygon_bounds
        );
    }

    public function test_geofence_only_update_records_location_activity(): void
    {
        [$user, $merchant, $location] = $this->createLocationContext();

        $polygonBounds = [
            [-29.7241, 31.0663],
            [-29.7241, 31.0683],
            [-29.7261, 31.0683],
            [-29.7261, 31.0663],
        ];

        $this->withHeader('Authorization', 'Bearer '.$user->createToken('test-suite')->plainTextToken)
            ->patchJson("/api/v1/locations/{$location->uuid}", [
                'polygon_bounds' => $polygonBounds,
            ])
            ->assertOk();

        $activity = ActivityLog::query()
            ->where('entity_type', 'location')
            ->where('entity_uuid', $location->uuid)
            ->where('title', 'Location updated')
            ->latest('id')
            ->first();

        $this->assertNotNull($activity);
        $this->assertSame('updated', $activity->action);
        $this->assertArrayHasKey('polygon_bounds', $activity->changes);
        $this->assertSame(
            'POLYGON((31.0663 -29.7241, 31.0683 -29.7241, 31.0683 -29.7261, 31.0663 -29.7261, 31.0663 -29.7241))',
            $activity->changes['polygon_bounds']['to']
        );
        $this->assertSame($merchant->id, $activity->merchant_id);
    }

    private function createLocationContext(): array
    {
        $user = User::factory()->create(['role' => 'user']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->account_id = $account->id;
        $user->save();

        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $location = Location::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'name' => 'Durban Depot',
            'address_line_1' => '1 Depot Road',
            'city' => 'Durban',
            'province' => 'KwaZulu-Natal',
            'post_code' => '4001',
            'latitude' => -29.7251,
            'longitude' => 31.0673,
        ]);

        return [$user, $merchant, $location];
    }
}
