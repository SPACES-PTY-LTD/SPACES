<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Driver;
use App\Models\Merchant;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class DriverIndexTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_can_search_drivers_by_name_or_email(): void
    {
        [$user, $merchant] = $this->createUserMerchant();

        $alphaUser = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'role' => 'driver',
            'account_id' => $merchant->account_id,
            'name' => 'Alpha Driver',
            'email' => 'alpha@example.com',
        ]));

        $betaUser = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'role' => 'driver',
            'account_id' => $merchant->account_id,
            'name' => 'Beta Driver',
            'email' => 'beta@example.com',
        ]));

        Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'user_id' => $alphaUser->id,
            'is_active' => true,
        ]);

        Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'user_id' => $betaUser->id,
            'is_active' => true,
        ]);

        $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/drivers?merchant_id=' . $merchant->uuid . '&search=Alpha')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Alpha Driver');

        $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/drivers?merchant_id=' . $merchant->uuid . '&search=beta@example.com')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.email', 'beta@example.com');
    }

    public function test_it_can_sort_drivers_by_name(): void
    {
        [$user, $merchant] = $this->createUserMerchant();

        $zuluUser = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'role' => 'driver',
            'account_id' => $merchant->account_id,
            'name' => 'Zulu Driver',
            'email' => 'zulu@example.com',
        ]));

        $alphaUser = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'role' => 'driver',
            'account_id' => $merchant->account_id,
            'name' => 'Alpha Driver',
            'email' => 'alpha@example.com',
        ]));

        Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'user_id' => $zuluUser->id,
            'is_active' => true,
        ]);

        Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'user_id' => $alphaUser->id,
            'is_active' => true,
        ]);

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/drivers?merchant_id=' . $merchant->uuid . '&sort_by=name&sort_direction=asc');

        $response->assertOk()
            ->assertJsonPath('data.0.name', 'Alpha Driver')
            ->assertJsonPath('data.1.name', 'Zulu Driver');
    }

    public function test_it_can_fetch_driver_details_for_the_requested_merchant(): void
    {
        [$user, $merchant] = $this->createUserMerchant();

        $otherMerchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $merchant->account_id,
        ]);
        $otherMerchant->users()->attach($user->id, ['role' => 'owner']);

        $driverUser = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'role' => 'driver',
            'account_id' => $merchant->account_id,
            'name' => 'Scoped Driver',
            'email' => 'scoped-driver@example.com',
        ]));

        $driver = Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $otherMerchant->id,
            'user_id' => $driverUser->id,
            'is_active' => true,
        ]);

        $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/drivers/' . $driver->uuid . '?merchant_id=' . $otherMerchant->uuid)
            ->assertOk()
            ->assertJsonPath('data.driver_id', $driver->uuid)
            ->assertJsonPath('data.name', 'Scoped Driver');
    }

    public function test_pagination_and_search_cover_all_matching_drivers(): void
    {
        [$user, $merchant] = $this->createUserMerchant();
        foreach (['Alpha Driver', 'Beta Driver', 'Zulu Driver'] as $name) {
            $this->createDriver($merchant, $name);
        }
        $url = '/api/v1/drivers?merchant_id=' . $merchant->uuid;

        $this->withHeaders($this->authHeaders($user))
            ->getJson($url . '&per_page=2&sort_by=name&sort_direction=asc')
            ->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.per_page', 2)->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.last_page', 2);
        $this->getJson($url . '&per_page=2&page=2&sort_by=name&sort_direction=asc')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Zulu Driver')
            ->assertJsonPath('meta.current_page', 2);
        $this->getJson($url . '&per_page=2&search=Zulu')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Zulu Driver')
            ->assertJsonPath('meta.total', 1);
    }

    public function test_filters_combine_and_support_false_values(): void
    {
        [$user, $merchant] = $this->createUserMerchant();
        $assigned = $this->createDriver($merchant, 'Imported Driver', [
            'is_active' => false, 'imported_at' => now(),
        ]);
        $vehicle = Vehicle::create([
            'account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'plate_number' => 'FILTER123', 'is_active' => true,
        ]);
        $assigned->vehicles()->attach($vehicle->id);
        $this->createDriver($merchant, 'Manual Driver');
        $this->createDriver($merchant, 'Other Inactive Driver', ['is_active' => false]);
        $url = '/api/v1/drivers?merchant_id=' . $merchant->uuid;

        $this->withHeaders($this->authHeaders($user))
            ->getJson($url . '&is_active=0&has_vehicle=1&source=imported')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.driver_id', $assigned->uuid)->assertJsonPath('meta.total', 1);
        $this->getJson($url . '&is_active=1&has_vehicle=0&source=manual')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Manual Driver');
        $this->getJson($url . '&sort_by=vehicles&sort_direction=desc')
            ->assertOk()->assertJsonPath('data.0.driver_id', $assigned->uuid);
        $vehicle->delete();
        $this->getJson($url . '&has_vehicle=1')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_extended_keyword_search_preserves_merchant_scope(): void
    {
        [$user, $merchant] = $this->createUserMerchant();
        $driver = $this->createDriver($merchant, 'Searchable Driver', ['intergration_id' => 'provider-456']);
        $driver->user->update(['telephone' => '0821234567']);
        $vehicle = Vehicle::create([
            'account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'plate_number' => 'SEARCH123', 'is_active' => true,
        ]);
        $driver->vehicles()->attach($vehicle->id);
        $otherMerchant = Merchant::factory()->create([
            'owner_user_id' => $user->id, 'account_id' => $merchant->account_id,
        ]);
        $this->createDriver($otherMerchant, 'Outside Driver', ['intergration_id' => 'provider-456']);
        foreach (['0821234567', 'provider-456', 'SEARCH123'] as $search) {
            $this->withHeaders($this->authHeaders($user))
                ->getJson('/api/v1/drivers?merchant_id=' . $merchant->uuid . '&search=' . $search)
                ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.driver_id', $driver->uuid);
        }
    }

    public function test_invalid_list_filters_are_rejected(): void
    {
        [$user, $merchant] = $this->createUserMerchant();
        foreach (['per_page=101', 'per_page=0', 'source=unknown', 'has_vehicle=maybe', 'is_active=maybe'] as $filter) {
            $this->withHeaders($this->authHeaders($user))
                ->getJson('/api/v1/drivers?merchant_id=' . $merchant->uuid . '&' . $filter)
                ->assertStatus(422);
        }
    }

    private function createDriver(Merchant $merchant, string $name, array $attributes = []): Driver
    {
        $driverUser = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'role' => 'driver', 'account_id' => $merchant->account_id, 'name' => $name,
        ]));

        return Driver::create(array_merge([
            'account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'user_id' => $driverUser->id, 'is_active' => true,
        ], $attributes));
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

    private function authHeaders(User $user): array
    {
        return [
            'Authorization' => 'Bearer ' . $user->createToken('test-token')->plainTextToken,
            'Accept' => 'application/json',
        ];
    }
}
