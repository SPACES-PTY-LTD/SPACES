<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Driver;
use App\Models\Merchant;
use App\Models\User;
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
