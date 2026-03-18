<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Location;
use App\Models\LocationType;
use App\Models\Merchant;
use App\Models\RouteStop;
use App\Models\User;
use App\Services\RouteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RouteServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_reuses_auto_route_without_creating_duplicate_stop_sequences(): void
    {
        $routeService = app(RouteService::class);
        $merchant = $this->createMerchant();
        $origin = $this->createLocation($merchant, 'Origin A', -33.9200, 18.4200);
        $destination = $this->createLocation($merchant, 'Destination B', -33.9300, 18.4300);

        $firstRoute = $routeService->findOrCreateAutoRoute($merchant, null, $origin, $destination);
        $secondRoute = $routeService->findOrCreateAutoRoute($merchant, null, $origin, $destination);

        $this->assertSame($firstRoute->id, $secondRoute->id);

        $activeStops = RouteStop::query()
            ->where('route_id', $firstRoute->id)
            ->orderBy('sequence')
            ->get();

        $this->assertCount(2, $activeStops);
        $this->assertSame([1, 2], $activeStops->pluck('sequence')->all());
        $this->assertSame([$origin->id, $destination->id], $activeStops->pluck('location_id')->all());

        $this->assertSame(
            2,
            RouteStop::withTrashed()->where('route_id', $firstRoute->id)->count()
        );
    }

    public function test_it_allows_duplicate_sequences_when_creating_route_stops(): void
    {
        $routeService = app(RouteService::class);
        [$merchant, $owner] = $this->createMerchantWithOwner();
        $locationA = $this->createLocation($merchant, 'Stop A', -33.9100, 18.4100);
        $locationB = $this->createLocation($merchant, 'Stop B', -33.9150, 18.4150);

        $route = $routeService->createRoute($owner, [
            'merchant_id' => $merchant->uuid,
            'title' => 'Duplicate Sequence Route',
            'code' => 'DUP-SEQ-ROUTE',
            'stops' => [
                ['location_id' => $locationA->uuid, 'sequence' => 1],
                ['location_id' => $locationB->uuid, 'sequence' => 1],
            ],
        ]);

        $activeStops = RouteStop::query()
            ->where('route_id', $route->id)
            ->orderBy('id')
            ->get();

        $this->assertCount(2, $activeStops);
        $this->assertSame([1, 1], $activeStops->pluck('sequence')->all());
        $this->assertSame([$locationA->id, $locationB->id], $activeStops->pluck('location_id')->all());
    }

    private function createMerchant(): Merchant
    {
        [$merchant] = $this->createMerchantWithOwner();

        return $merchant;
    }

    private function createMerchantWithOwner(): array
    {
        $user = User::withoutEvents(fn () => User::factory()->create(['role' => 'user']));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();

        $merchant = Merchant::create([
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
            'name' => fake()->company(),
            'legal_name' => fake()->company().' LLC',
            'status' => 'active',
            'timezone' => 'UTC',
            'operating_countries' => ['US'],
            'allow_auto_shipment_creations_at_locations' => true,
        ]);

        $merchant->users()->attach($user->id, ['role' => 'owner']);

        return [$merchant, $user];
    }

    private function createLocation(Merchant $merchant, string $name, float $lat, float $lng): Location
    {
        $waypointType = LocationType::firstOrCreate(
            ['merchant_id' => $merchant->id, 'slug' => 'waypoint'],
            [
                'account_id' => $merchant->account_id,
                'title' => 'Waypoint',
                'collection_point' => false,
                'delivery_point' => false,
                'sequence' => 5,
                'default' => true,
            ]
        );

        return Location::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'name' => $name,
            'address_line_1' => '123 Main St',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
            'latitude' => $lat,
            'longitude' => $lng,
            'location_type_id' => $waypointType->id,
            'metadata' => ['geofence_radius_meters' => 120],
        ]);
    }
}
