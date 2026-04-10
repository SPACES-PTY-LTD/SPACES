<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Location;
use App\Models\LocationType;
use App\Models\Merchant;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Tests\TestCase;

class LocationCsvImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_location_csv_import_uses_first_collection_location_type_for_loading_locations(): void
    {
        [$user, $merchant] = $this->createUserMerchant();

        $collectionType = LocationType::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'uuid' => (string) Str::uuid(),
            'slug' => 'pickup',
            'title' => 'Pickup',
            'collection_point' => true,
            'delivery_point' => false,
            'sequence' => 1,
            'default' => false,
        ]);

        LocationType::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'uuid' => (string) Str::uuid(),
            'slug' => 'dropoff',
            'title' => 'Dropoff',
            'collection_point' => false,
            'delivery_point' => true,
            'sequence' => 2,
            'default' => false,
        ]);

        $csv = <<<CSV
code,address_line_1,city,province,post_code,is_loading_location
LOAD-001,1 Dock Road,Cape Town,Western Cape,8001,true
CSV;

        $response = $this->withAuthToken($user)->post('/api/v1/locations/import', [
            'merchant_id' => $merchant->uuid,
            'file' => UploadedFile::fake()->createWithContent('locations.csv', $csv),
        ]);

        $response->assertOk()
            ->assertJsonPath('data.failed', 0);

        $this->assertDatabaseHas('locations', [
            'merchant_id' => $merchant->id,
            'code' => 'LOAD-001',
            'location_type_id' => $collectionType->id,
        ]);
    }

    public function test_location_csv_import_keeps_waypoint_fallback_for_non_loading_rows(): void
    {
        [$user, $merchant] = $this->createUserMerchant();

        $csv = <<<CSV
code,address_line_1,city,province,post_code,is_loading_location
LOAD-002,2 Dock Road,Cape Town,Western Cape,8001,false
CSV;

        $response = $this->withAuthToken($user)->post('/api/v1/locations/import', [
            'merchant_id' => $merchant->uuid,
            'file' => UploadedFile::fake()->createWithContent('locations.csv', $csv),
        ]);

        $response->assertOk()
            ->assertJsonPath('data.failed', 0);

        $waypointType = LocationType::query()
            ->where('merchant_id', $merchant->id)
            ->where('slug', 'waypoint')
            ->first();

        $this->assertNotNull($waypointType);
        $this->assertDatabaseHas('locations', [
            'merchant_id' => $merchant->id,
            'code' => 'LOAD-002',
            'location_type_id' => $waypointType->id,
        ]);
    }

    public function test_location_csv_import_creates_reuses_and_deduplicates_tags(): void
    {
        [$user, $merchant] = $this->createUserMerchant();

        Tag::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'name' => 'Priority',
            'slug' => 'priority',
        ]);

        $csv = implode("\n", [
            'code,address_line_1,city,province,post_code,tags',
            'TAG-001,1 Dock Road,Cape Town,Western Cape,8001,"Depot, Priority, depot"',
        ]);

        $response = $this->withAuthToken($user)->post('/api/v1/locations/import', [
            'merchant_id' => $merchant->uuid,
            'file' => UploadedFile::fake()->createWithContent('locations.csv', $csv),
        ]);

        $response->assertOk()
            ->assertJsonPath('data.failed', 0);

        $location = Location::query()
            ->where('merchant_id', $merchant->id)
            ->where('code', 'TAG-001')
            ->firstOrFail();

        $this->assertSame(['Depot', 'Priority'], $location->tags()->pluck('name')->all());
        foreach ($location->tags as $tag) {
            $this->assertDatabaseHas('taggables', [
                'tag_id' => $tag->id,
                'taggable_type' => Location::class,
                'taggable_id' => $location->id,
            ]);
        }
    }

    public function test_location_csv_import_clears_tags_when_tags_column_is_blank(): void
    {
        [$user, $merchant] = $this->createUserMerchant();

        $location = Location::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'code' => 'TAG-002',
            'name' => 'Tagged Location',
            'address_line_1' => '2 Dock Road',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
        ]);
        $tag = Tag::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'name' => 'Depot',
            'slug' => 'depot',
        ]);
        $location->tags()->sync([$tag->id]);

        $csv = implode("\n", [
            'code,address_line_1,city,province,post_code,tags',
            'TAG-002,2 Dock Road,Cape Town,Western Cape,8001,',
        ]);

        $response = $this->withAuthToken($user)->post('/api/v1/locations/import', [
            'merchant_id' => $merchant->uuid,
            'file' => UploadedFile::fake()->createWithContent('locations.csv', $csv),
        ]);

        $response->assertOk()
            ->assertJsonPath('data.failed', 0)
            ->assertJsonPath('data.updated', 1);

        $this->assertSame([], $location->fresh()->tags()->pluck('name')->all());
    }

    public function test_location_csv_import_leaves_existing_tags_when_tags_column_is_missing(): void
    {
        [$user, $merchant] = $this->createUserMerchant();

        $location = Location::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'code' => 'TAG-003',
            'name' => 'Tagged Location',
            'address_line_1' => '3 Dock Road',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
        ]);
        $tag = Tag::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'name' => 'Depot',
            'slug' => 'depot',
        ]);
        $location->tags()->sync([$tag->id]);

        $csv = implode("\n", [
            'code,address_line_1,city,province,post_code',
            'TAG-003,3 Dock Road,Cape Town,Western Cape,8001',
        ]);

        $response = $this->withAuthToken($user)->post('/api/v1/locations/import', [
            'merchant_id' => $merchant->uuid,
            'file' => UploadedFile::fake()->createWithContent('locations.csv', $csv),
        ]);

        $response->assertOk()
            ->assertJsonPath('data.failed', 0)
            ->assertJsonPath('data.updated', 1);

        $this->assertSame(['Depot'], $location->fresh()->tags()->pluck('name')->all());
    }

    private function createUserMerchant(): array
    {
        $user = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'role' => 'user',
        ]));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();

        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        return [$user, $merchant];
    }

    private function withAuthToken(User $user): self
    {
        return $this->withHeader('Authorization', 'Bearer ' . $user->createToken('test-suite')->plainTextToken);
    }
}
