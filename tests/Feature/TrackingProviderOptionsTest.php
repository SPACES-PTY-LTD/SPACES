<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\TrackingProvider;
use App\Models\TrackingProviderIntegrationFormField;
use App\Models\TrackingProviderOption;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrackingProviderOptionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_crud_tracking_provider_options(): void
    {
        $admin = User::withoutEvents(fn () => User::factory()->create(['role' => 'super_admin']));
        $provider = TrackingProvider::create([
            'name' => 'Mixtelematics',
            'status' => 'active',
        ]);

        $create = $this->actingAs($admin)->postJson("/api/v1/admin/tracking-providers/{$provider->uuid}/options", [
            'label' => 'Timezone',
            'name' => 'timezone',
            'type' => 'select',
            'options' => ['Africa/Johannesburg', 'UTC'],
            'order_id' => 1,
        ]);

        $create->assertStatus(201);
        $optionId = $create->json('data.option_id');
        $this->assertNotEmpty($optionId);

        $this->actingAs($admin)
            ->getJson("/api/v1/admin/tracking-providers/{$provider->uuid}/options")
            ->assertStatus(200)
            ->assertJsonPath('data.0.name', 'timezone');

        $this->actingAs($admin)
            ->patchJson("/api/v1/admin/tracking-providers/{$provider->uuid}/options/{$optionId}", [
                'label' => 'Provider Timezone',
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.label', 'Provider Timezone');

        $this->actingAs($admin)
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

        $this->actingAs($user)->postJson('/api/v1/tracking-providers/activate', [
            'provider_id' => $provider->uuid,
            'integration_data' => [
                'api_key' => 'key-123',
            ],
        ])->assertStatus(201);

        $update = $this->actingAs($user)->putJson("/api/v1/tracking-providers/{$provider->uuid}/options_data", [
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

        $this->actingAs($user)->putJson("/api/v1/tracking-providers/{$provider->uuid}/options_data", [
            'merchant_id' => $merchant->uuid,
            'integration_options_data' => [
                'timezone' => 'UTC',
            ],
        ])->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    private function createUserAndMerchant(): array
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

        return [$user, $merchant];
    }
}
