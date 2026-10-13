<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Driver;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DriverLoginTest extends TestCase
{
    use RefreshDatabase;

    private function context(): array
    {
        $owner = User::factory()->create();
        $account = Account::create(['owner_user_id' => $owner->id]);
        $user = User::factory()->create(['role' => 'driver', 'account_id' => $account->id, 'password' => 'password123']);
        $merchant = Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $owner->id]);
        $driver = Driver::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'user_id' => $user->id, 'is_active' => true]);

        return [$user, $merchant, $driver];
    }

    public function test_lookup_returns_only_active_assigned_merchants_and_validates_email(): void
    {
        [$user, $merchant, $driver] = $this->context();
        $this->postJson('/api/v1/auth/driver-merchants', ['email' => strtoupper($user->email)])
            ->assertOk()->assertJsonCount(1, 'data.merchants')->assertJsonPath('data.merchants.0.merchant_id', $merchant->uuid)
            ->assertJsonMissingPath('data.token');
        $this->postJson('/api/v1/auth/driver-merchants', ['email' => 'missing@example.com'])->assertOk()->assertJsonCount(0, 'data.merchants');
        $this->postJson('/api/v1/auth/driver-merchants', ['email' => 'invalid'])->assertUnprocessable();
        $driver->update(['is_active' => false]);
        $this->postJson('/api/v1/auth/driver-merchants', ['email' => $user->email])->assertOk()->assertJsonCount(0, 'data.merchants');
        $driver->update(['is_active' => true]);
        $merchant->delete();
        $this->postJson('/api/v1/auth/driver-merchants', ['email' => $user->email])->assertOk()->assertJsonCount(0, 'data.merchants');
    }

    public function test_single_merchant_login_and_invalid_selections(): void
    {
        [$user, $merchant] = $this->context();
        $credentials = ['email' => $user->email, 'password' => 'password123', 'login_context' => 'driver'];
        $this->postJson('/api/v1/auth/login', $credentials)->assertOk()->assertJsonPath('data.user.driver_merchant.merchant_id', $merchant->uuid);
        [, $foreign] = $this->context();
        $this->postJson('/api/v1/auth/login', [...$credentials, 'merchant_id' => $foreign->uuid])->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', [...$credentials, 'password' => 'wrong', 'merchant_id' => $merchant->uuid])->assertUnauthorized();
        $user->update(['role' => 'user']);
        $this->postJson('/api/v1/auth/login', $credentials)->assertUnauthorized();
    }

    public function test_multiple_merchants_require_selection_and_scope_login_refresh_and_runs(): void
    {
        [$user, $first, $firstDriver] = $this->context();
        $second = Merchant::factory()->create(['account_id' => $user->account_id, 'owner_user_id' => $first->owner_user_id]);
        $secondDriver = Driver::create(['account_id' => $user->account_id, 'merchant_id' => $second->id, 'user_id' => $user->id, 'is_active' => true]);
        foreach ([$firstDriver, $secondDriver] as $driver) {
            Run::create(['account_id' => $driver->account_id, 'merchant_id' => $driver->merchant_id, 'driver_id' => $driver->id, 'status' => 'draft']);
        }
        $credentials = ['email' => $user->email, 'password' => 'password123', 'login_context' => 'driver'];
        $this->postJson('/api/v1/auth/driver-merchants', ['email' => $user->email])->assertOk()->assertJsonCount(2, 'data.merchants');
        $this->postJson('/api/v1/auth/login', $credentials)->assertUnauthorized();
        $firstLogin = $this->postJson('/api/v1/auth/login', [...$credentials, 'merchant_id' => $first->uuid])->assertOk();
        $login = $this->postJson('/api/v1/auth/login', [...$credentials, 'merchant_id' => $second->uuid])
            ->assertOk()->assertJsonPath('data.user.driver_merchant.merchant_id', $second->uuid);
        $this->getJson('/api/v1/driver/runs', ['Authorization' => 'Bearer '.$login->json('data.token')])
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.run_id', $secondDriver->runs()->first()->uuid);
        $this->getJson('/api/v1/driver/runs', ['Authorization' => 'Bearer '.$firstLogin->json('data.token')])
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.run_id', $firstDriver->runs()->first()->uuid);
        $this->app['auth']->forgetGuards();
        $refresh = $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $login->json('data.refresh_token')])
            ->assertOk()->assertJsonPath('data.user.driver_merchant.merchant_id', $second->uuid);
        $secondDriver->update(['is_active' => false]);
        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $refresh->json('data.refresh_token')])->assertUnauthorized();
    }
}
