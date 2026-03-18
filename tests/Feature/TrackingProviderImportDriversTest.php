<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\MerchantIntegration;
use App\Models\TrackingProvider;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrackingProviderImportDriversTest extends TestCase
{
    use RefreshDatabase;

    public function test_import_drivers_endpoint_imports_when_provider_supports_it(): void
    {
        [$user, $merchant, $account] = $this->createUserMerchantAccount();

        $provider = TrackingProvider::create([
            'name' => 'Fake Import Drivers Provider',
            'status' => 'active',
        ]);

        config()->set('tracking_providers.services.fake-import-drivers-provider', FakeImportDriversProviderService::class);

        MerchantIntegration::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'provider_id' => $provider->id,
            'integration_data' => ['token' => 'abc'],
        ]);

        $response = $this->actingAs($user)->postJson("/api/v1/tracking-providers/{$provider->uuid}/import_drivers", [
            'merchant_id' => $merchant->uuid,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.imported_count', 2)
            ->assertJsonPath('data.drivers.0.merchant_id', $merchant->uuid)
            ->assertJsonPath('data.drivers.0.intergration_id', 'drv-123')
            ->assertJsonPath('data.drivers.0.name', 'Jane Doe')
            ->assertJsonPath('data.drivers.0.telephone', '+27110000001')
            ->assertJsonPath('data.drivers.1.intergration_id', 'drv-456');

        $this->assertDatabaseHas('drivers', [
            'merchant_id' => $merchant->id,
            'intergration_id' => 'drv-123',
        ]);

        $this->assertDatabaseHas('drivers', [
            'merchant_id' => $merchant->id,
            'intergration_id' => 'drv-456',
        ]);
    }

    public function test_import_drivers_endpoint_returns_error_when_not_supported(): void
    {
        [$user, $merchant, $account] = $this->createUserMerchantAccount();

        $provider = TrackingProvider::create([
            'name' => 'Fake No Import Drivers Provider',
            'status' => 'active',
        ]);

        config()->set('tracking_providers.services.fake-no-import-drivers-provider', FakeNoImportDriversProviderService::class);

        MerchantIntegration::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'provider_id' => $provider->id,
            'integration_data' => ['token' => 'abc'],
        ]);

        $response = $this->actingAs($user)->postJson("/api/v1/tracking-providers/{$provider->uuid}/import_drivers", [
            'merchant_id' => $merchant->uuid,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    private function createUserMerchantAccount(): array
    {
        $user = User::withoutEvents(fn () => User::factory()->create(['role' => 'user']));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->account_id = $account->id;
        $user->save();

        $merchant = Merchant::withoutEvents(fn () => Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]));
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        return [$user, $merchant, $account];
    }
}

class FakeImportDriversProviderService
{
    public function import_drivers(array $integrationData = [], array $integrationOptionsData = []): array
    {
        return [
            [
                'integration_id' => 'drv-123',
                'name' => 'Jane Doe',
                'email' => 'jane@example.com',
                'telephone' => '+27110000001',
                'is_active' => true,
            ],
            [
                'integration_id' => 'drv-456',
                'name' => 'John Doe',
                'email' => 'john@example.com',
                'telephone' => '+27110000002',
                'is_active' => true,
            ],
        ];
    }
}

class FakeNoImportDriversProviderService
{
}
