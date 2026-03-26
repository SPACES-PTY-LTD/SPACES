<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\MerchantIntegration;
use App\Models\TrackingProvider;
use App\Models\TrackingProviderIntegrationFormField;
use App\Models\TrackingProviderOption;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class TrackingProviderOptionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_crud_tracking_provider_options(): void
    {
        $admin = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'role' => 'super_admin',
        ]));
        $provider = TrackingProvider::create([
            'name' => 'Mixtelematics',
            'status' => 'active',
        ]);

        $create = $this->apiFor($admin)->postJson("/api/v1/admin/tracking-providers/{$provider->uuid}/options", [
            'label' => 'Timezone',
            'name' => 'timezone',
            'type' => 'select',
            'options' => ['Africa/Johannesburg', 'UTC'],
            'order_id' => 1,
        ]);

        $create->assertStatus(201);
        $optionId = $create->json('data.option_id');
        $this->assertNotEmpty($optionId);

        $this->apiFor($admin)
            ->getJson("/api/v1/admin/tracking-providers/{$provider->uuid}/options")
            ->assertStatus(200)
            ->assertJsonPath('data.0.name', 'timezone');

        $this->apiFor($admin)
            ->patchJson("/api/v1/admin/tracking-providers/{$provider->uuid}/options/{$optionId}", [
                'label' => 'Provider Timezone',
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.label', 'Provider Timezone');

        $this->apiFor($admin)
            ->deleteJson("/api/v1/admin/tracking-providers/{$provider->uuid}/options/{$optionId}")
            ->assertStatus(200);
    }

    public function test_user_can_update_integration_options_data_for_activated_provider(): void
    {
        [$user, $merchant] = $this->createUserAndMerchant();

        $provider = TrackingProvider::create([
            'name' => 'Mixtelematics',
            'status' => 'active',
        ]);

        TrackingProviderIntegrationFormField::create([
            'provider_id' => $provider->id,
            'label' => 'API Key',
            'name' => 'api_key',
            'type' => 'text',
            'is_required' => true,
            'order_id' => 1,
        ]);

        TrackingProviderOption::create([
            'provider_id' => $provider->id,
            'label' => 'Use Last Known Position',
            'name' => 'use_last_known_position',
            'type' => 'boolean',
            'order_id' => 1,
        ]);

        TrackingProviderOption::create([
            'provider_id' => $provider->id,
            'label' => 'Timezone',
            'name' => 'timezone',
            'type' => 'select',
            'options' => ['Africa/Johannesburg', 'UTC'],
            'order_id' => 2,
        ]);

        $this->apiFor($user)->postJson('/api/v1/tracking-providers/activate', [
            'provider_id' => $provider->uuid,
            'merchant_id' => $merchant->uuid,
            'integration_data' => [
                'api_key' => 'key-123',
            ],
        ])->assertStatus(201);

        $update = $this->apiFor($user)->putJson("/api/v1/tracking-providers/{$provider->uuid}/options_data", [
            'merchant_id' => $merchant->uuid,
            'integration_options_data' => [
                'use_last_known_position' => true,
                'timezone' => 'UTC',
            ],
        ]);

        $update->assertStatus(200)
            ->assertJsonPath('data.provider.integration_options_data.use_last_known_position', true)
            ->assertJsonPath('data.provider.integration_options_data.timezone', 'UTC')
            ->assertJsonPath('data.provider.options.0.name', 'use_last_known_position');
    }

    public function test_user_cannot_update_integration_options_data_for_non_activated_provider(): void
    {
        [$user, $merchant] = $this->createUserAndMerchant();

        $provider = TrackingProvider::create([
            'name' => 'Mixtelematics',
            'status' => 'active',
        ]);

        TrackingProviderOption::create([
            'provider_id' => $provider->id,
            'label' => 'Timezone',
            'name' => 'timezone',
            'type' => 'select',
            'options' => ['Africa/Johannesburg', 'UTC'],
            'order_id' => 1,
        ]);

        $this->apiFor($user)->putJson("/api/v1/tracking-providers/{$provider->uuid}/options_data", [
            'merchant_id' => $merchant->uuid,
            'integration_options_data' => [
                'timezone' => 'UTC',
            ],
        ])->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_user_can_activate_provider_for_a_selected_merchant(): void
    {
        [$user, $merchant] = $this->createUserAndMerchant();

        $secondMerchant = Merchant::withoutEvents(fn () => Merchant::factory()->create([
            'uuid' => (string) Str::uuid(),
            'owner_user_id' => $user->id,
            'account_id' => $merchant->account_id,
        ]));
        $secondMerchant->users()->attach($user->id, ['role' => 'owner']);

        $provider = TrackingProvider::create([
            'name' => 'Mixtelematics',
            'status' => 'active',
        ]);

        TrackingProviderIntegrationFormField::create([
            'provider_id' => $provider->id,
            'label' => 'API Key',
            'name' => 'api_key',
            'type' => 'text',
            'is_required' => true,
            'order_id' => 1,
        ]);

        $this->apiFor($user)->postJson('/api/v1/tracking-providers/activate', [
            'provider_id' => $provider->uuid,
            'merchant_id' => $secondMerchant->uuid,
            'integration_data' => [
                'api_key' => 'key-456',
            ],
        ])->assertStatus(201);

        $this->assertDatabaseHas('merchant_integrations', [
            'merchant_id' => $secondMerchant->id,
            'provider_id' => $provider->id,
        ]);

        $this->assertDatabaseMissing('merchant_integrations', [
            'merchant_id' => $merchant->id,
            'provider_id' => $provider->id,
        ]);

        $integration = MerchantIntegration::query()
            ->where('merchant_id', $secondMerchant->id)
            ->where('provider_id', $provider->id)
            ->first();

        $this->assertNotNull($integration);
        $this->assertSame('key-456', $integration->integration_data['api_key'] ?? null);
    }

    private function createUserAndMerchant(): array
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

        return [$user, $merchant];
    }

    private function apiFor(User $user)
    {
        return $this->withHeader(
            'Authorization',
            'Bearer '.$user->createToken('test-suite')->plainTextToken
        );
    }
}
