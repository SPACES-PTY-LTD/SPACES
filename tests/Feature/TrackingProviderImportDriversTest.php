<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\MerchantIntegration;
use App\Models\TrackingProvider;
use App\Models\User;
use App\Jobs\ImportProviderDriversJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class TrackingProviderImportDriversTest extends TestCase
{
    use RefreshDatabase;

    public function test_import_drivers_endpoint_queues_import_when_provider_supports_it(): void
    {
        [$user, $merchant, $account] = $this->createUserMerchantAccount();
        Queue::fake();

        $provider = TrackingProvider::create([
            'name' => 'Fake Import Drivers Provider',
            'status' => 'active',
            'has_driver_importing' => true,
        ]);

        config()->set('tracking_providers.services.fake-import-drivers-provider', FakeImportDriversProviderService::class);

        MerchantIntegration::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'provider_id' => $provider->id,
            'integration_data' => ['token' => 'abc'],
        ]);

        $response = $this->apiFor($user)->postJson("/api/v1/tracking-providers/{$provider->uuid}/import_drivers", [
            'merchant_id' => $merchant->uuid,
        ]);

        $response->assertStatus(202)
            ->assertJsonPath('data.queued', true)
            ->assertJsonPath('data.already_in_progress', false);

        Queue::assertPushed(ImportProviderDriversJob::class, function (ImportProviderDriversJob $job) use ($user, $merchant, $provider) {
            return $job->userId === $user->id
                && $job->merchantId === $merchant->id
                && $job->merchantUuid === $merchant->uuid
                && $job->providerUuid === $provider->uuid;
        });
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

        $response = $this->apiFor($user)->postJson("/api/v1/tracking-providers/{$provider->uuid}/import_drivers", [
            'merchant_id' => $merchant->uuid,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    private function createUserMerchantAccount(): array
    {
        $user = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'role' => 'user',
        ]));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->account_id = $account->id;
        $user->save();

        $merchant = Merchant::withoutEvents(fn () => Merchant::factory()->create([
            'uuid' => (string) Str::uuid(),
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]));
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        return [$user, $merchant, $account];
    }

    private function apiFor(User $user)
    {
        return $this->withHeader(
            'Authorization',
            'Bearer '.$user->createToken('test-suite')->plainTextToken
        );
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
