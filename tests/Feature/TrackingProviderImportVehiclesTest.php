<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\MerchantIntegration;
use App\Models\TrackingProvider;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrackingProviderImportVehiclesTest extends TestCase
{
    use RefreshDatabase;

    public function test_import_vehicles_endpoint_imports_when_provider_supports_it(): void
    {
        [$user, $merchant, $account] = $this->createUserMerchantAccount();

        $provider = TrackingProvider::create([
            'name' => 'Fake Import Provider',
            'status' => 'active',
        ]);

        config()->set('tracking_providers.services.fake-import-provider', FakeImportVehiclesProviderService::class);

        MerchantIntegration::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'provider_id' => $provider->id,
            'integration_data' => ['token' => 'abc'],
        ]);

        $response = $this->actingAs($user)->postJson("/api/v1/tracking-providers/{$provider->uuid}/import_vehicles", [
            'merchant_id' => $merchant->uuid,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.imported_count', 2)
            ->assertJsonPath('data.vehicles.0.intergration_id', '123_456')
            ->assertJsonPath('data.vehicles.0.odometer', 125000)
            ->assertJsonPath('data.vehicles.0.year', 2022)
            ->assertJsonPath('data.vehicles.1.intergration_id', '999_888');
    }

    public function test_import_vehicles_endpoint_returns_error_when_not_supported(): void
    {
        [$user, $merchant, $account] = $this->createUserMerchantAccount();

        $provider = TrackingProvider::create([
            'name' => 'Fake No Import Provider',
            'status' => 'active',
        ]);

        config()->set('tracking_providers.services.fake-no-import-provider', FakeNoImportVehiclesProviderService::class);

        MerchantIntegration::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'provider_id' => $provider->id,
            'integration_data' => ['token' => 'abc'],
        ]);

        $response = $this->actingAs($user)->postJson("/api/v1/tracking-providers/{$provider->uuid}/import_vehicles", [
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

class FakeImportVehiclesProviderService
{
    public function import_vehicles(array $integrationData = [], array $integrationOptionsData = []): array
    {
        return [
            [
                'integration_id' => '123_456',
                'plate_number' => 'CA12345',
                'make' => 'Toyota',
                'model' => 'Hilux',
                'odometer' => 125000,
                'year' => 2022,
            ],
            [
                'integration_id' => '999_888',
                'plate_number' => 'CA54321',
                'make' => 'Ford',
                'model' => 'Ranger',
                'odometer' => 99000,
                'year' => 2020,
            ],
        ];
    }
}

class FakeNoImportVehiclesProviderService
{
}
