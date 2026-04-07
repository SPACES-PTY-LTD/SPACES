<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Location;
use App\Models\LocationType;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocationIndexFiltersTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_filters_locations_by_location_type_and_search_term(): void
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

        $pickupType = LocationType::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'slug' => 'pickup',
            'title' => 'Pickup',
            'collection_point' => true,
            'delivery_point' => false,
            'sequence' => 1,
            'default' => false,
        ]);

        $dropoffType = LocationType::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'slug' => 'dropoff',
            'title' => 'Dropoff',
            'collection_point' => false,
            'delivery_point' => true,
            'sequence' => 2,
            'default' => false,
        ]);

        $matchingLocation = Location::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'location_type_id' => $pickupType->id,
            'name' => 'Central Depot Alpha',
            'code' => 'ALPHA-1',
            'address_line_1' => '1 Depot Street',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
        ]);

        Location::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'location_type_id' => $pickupType->id,
            'name' => 'North Hub',
            'code' => 'BRAVO-2',
            'address_line_1' => '2 Warehouse Road',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
        ]);

        Location::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'location_type_id' => $dropoffType->id,
            'name' => 'Central Depot Dropoff',
            'code' => 'ALPHA-3',
            'address_line_1' => '3 Delivery Avenue',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$user->createToken('test-suite')->plainTextToken)
            ->getJson('/api/v1/locations?' . http_build_query([
                'merchant_id' => $merchant->uuid,
                'location_type_id' => $pickupType->uuid,
                'search' => 'Central Alpha',
            ]));

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.location_id', $matchingLocation->uuid)
            ->assertJsonPath('data.0.type.location_type_id', $pickupType->uuid);
    }
}
