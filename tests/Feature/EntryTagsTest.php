<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\Tag;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EntryTagsTest extends TestCase
{
    use RefreshDatabase;

    private function authenticated(User $user): self
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('test-suite')->plainTextToken);
    }

    private function createMerchantUser(): array
    {
        $user = User::factory()->create(['role' => 'user']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();

        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        return [$user, $account, $merchant];
    }

    private function createVehicle(Account $account, Merchant $merchant): Vehicle
    {
        return Vehicle::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'make' => 'Toyota',
            'model' => 'Hilux',
            'plate_number' => 'TAG-001',
            'is_active' => true,
        ]);
    }

    private function createLocation(Account $account, Merchant $merchant): Location
    {
        return Location::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'name' => 'Central Depot',
            'address_line_1' => '1 Depot Street',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
        ]);
    }

    public function test_it_creates_reuses_and_deduplicates_vehicle_tags(): void
    {
        [$user, $account, $merchant] = $this->createMerchantUser();
        $vehicle = $this->createVehicle($account, $merchant);
        Tag::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'name' => 'Cold Chain',
            'slug' => 'cold-chain',
        ]);

        $response = $this->authenticated($user)->patchJson("/api/v1/vehicles/{$vehicle->uuid}/tags", [
            'tags' => ['Cold Chain', ' cold   chain ', 'Priority'],
        ]);

        $response->assertOk()
            ->assertJsonPath('data.vehicle_id', $vehicle->uuid)
            ->assertJsonCount(2, 'data.tags')
            ->assertJsonPath('data.tags.0.name', 'Cold Chain')
            ->assertJsonPath('data.tags.1.name', 'Priority');

        $this->assertDatabaseCount('tags', 2);
        $this->assertDatabaseCount('taggables', 2);
        $this->assertDatabaseHas('activity_logs', [
            'entity_type' => 'vehicle',
            'entity_uuid' => $vehicle->uuid,
            'title' => 'Vehicle tags updated',
        ]);
    }

    public function test_it_creates_and_reuses_location_tags_from_same_catalog(): void
    {
        [$user, $account, $merchant] = $this->createMerchantUser();
        $vehicle = $this->createVehicle($account, $merchant);
        $location = $this->createLocation($account, $merchant);

        $this->authenticated($user)->patchJson("/api/v1/vehicles/{$vehicle->uuid}/tags", [
            'tags' => ['Priority'],
        ])->assertOk();

        $response = $this->authenticated($user)->patchJson("/api/v1/locations/{$location->uuid}/tags", [
            'tags' => ['Priority', 'Depot'],
        ]);

        $response->assertOk()
            ->assertJsonPath('data.location_id', $location->uuid)
            ->assertJsonCount(2, 'data.tags')
            ->assertJsonPath('data.tags.0.name', 'Depot')
            ->assertJsonPath('data.tags.1.name', 'Priority');

        $this->assertDatabaseCount('tags', 2);
        $this->assertDatabaseCount('taggables', 3);
        $this->assertDatabaseHas('activity_logs', [
            'entity_type' => 'location',
            'entity_uuid' => $location->uuid,
            'title' => 'Location tags updated',
        ]);
    }

    public function test_resource_responses_include_assigned_tags(): void
    {
        [$user, $account, $merchant] = $this->createMerchantUser();
        $location = $this->createLocation($account, $merchant);
        $tag = Tag::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'name' => 'Depot',
            'slug' => 'depot',
        ]);
        $location->tags()->sync([$tag->id]);

        $this->authenticated($user)
            ->getJson("/api/v1/locations/{$location->uuid}")
            ->assertOk()
            ->assertJsonPath('data.tags.0.tag_id', $tag->uuid)
            ->assertJsonPath('data.tags.0.name', 'Depot');
    }

    public function test_user_cannot_assign_tags_to_another_accounts_entity(): void
    {
        [$user] = $this->createMerchantUser();
        [, $otherAccount, $otherMerchant] = $this->createMerchantUser();
        $otherLocation = $this->createLocation($otherAccount, $otherMerchant);

        $this->authenticated($user)
            ->patchJson("/api/v1/locations/{$otherLocation->uuid}/tags", [
                'tags' => ['Priority'],
            ])
            ->assertNotFound();
    }

    public function test_it_lists_tags_for_the_requested_merchant(): void
    {
        [$user, $account, $merchant] = $this->createMerchantUser();
        $otherMerchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $otherMerchant->users()->attach($user->id, ['role' => 'owner']);

        $matching = Tag::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'name' => 'Depot',
            'slug' => 'depot',
        ]);
        Tag::create([
            'account_id' => $account->id,
            'merchant_id' => $otherMerchant->id,
            'name' => 'Depot',
            'slug' => 'depot',
        ]);

        $this->authenticated($user)
            ->getJson('/api/v1/tags?'.http_build_query([
                'merchant_id' => $merchant->uuid,
                'search' => 'dep',
            ]))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.tag_id', $matching->uuid);
    }

    public function test_it_filters_vehicles_by_tag(): void
    {
        [$user, $account, $merchant] = $this->createMerchantUser();
        $matchingVehicle = $this->createVehicle($account, $merchant);
        $otherVehicle = Vehicle::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'make' => 'Isuzu',
            'model' => 'NPR',
            'plate_number' => 'TAG-002',
            'is_active' => true,
        ]);
        $tag = Tag::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'name' => 'Cold Chain',
            'slug' => 'cold-chain',
        ]);

        $matchingVehicle->tags()->sync([$tag->id]);

        $this->authenticated($user)
            ->getJson('/api/v1/vehicles?'.http_build_query([
                'merchant_id' => $merchant->uuid,
                'tag_id' => $tag->uuid,
            ]))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.vehicle_id', $matchingVehicle->uuid)
            ->assertJsonMissing(['vehicle_id' => $otherVehicle->uuid]);
    }

    public function test_it_filters_locations_by_tag(): void
    {
        [$user, $account, $merchant] = $this->createMerchantUser();
        $matchingLocation = $this->createLocation($account, $merchant);
        $otherLocation = Location::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'name' => 'North Hub',
            'address_line_1' => '2 Warehouse Road',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
        ]);
        $tag = Tag::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'name' => 'Depot',
            'slug' => 'depot',
        ]);

        $matchingLocation->tags()->sync([$tag->id]);

        $this->authenticated($user)
            ->getJson('/api/v1/locations?'.http_build_query([
                'merchant_id' => $merchant->uuid,
                'tag_id' => $tag->uuid,
            ]))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.location_id', $matchingLocation->uuid)
            ->assertJsonMissing(['location_id' => $otherLocation->uuid]);
    }
}
