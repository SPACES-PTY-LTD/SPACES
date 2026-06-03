<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\MerchantIntegration;
use App\Models\TrackingProvider;
use App\Models\User;
use App\Services\Mixtelematics\MixIntegrateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PowerfleetOrganisationToolsTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_fetch_powerfleet_organisations_subgroups_and_details(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedPowerfleetProvider();

        app()->instance(MixIntegrateService::class, new class extends MixIntegrateService {
            public function getPowerfleetOrganisations(array $integrationData = []): array
            {
                return [
                    [
                        'GroupId' => -293601279,
                        'Name' => 'Main Organisation',
                        'Type' => 'OrganisationGroup',
                        'DisplayTimeZone' => 'Africa/Johannesburg',
                    ],
                ];
            }

            public function getPowerfleetSubGroups(string|int $groupId, array $integrationData = []): array
            {
                return [
                    'GroupId' => (int) $groupId,
                    'Name' => 'Main Organisation',
                    'Type' => 'OrganisationGroup',
                    'SubGroups' => [
                        [
                            'GroupId' => 123456,
                            'Name' => 'Depot A',
                            'Type' => 'DefaultSite',
                        ],
                    ],
                ];
            }

            public function getPowerfleetOrganisationDetails(string|int $groupId, array $integrationData = []): array
            {
                return [
                    'GroupId' => (int) $groupId,
                    'Name' => 'Depot A',
                    'GroupType' => 'DefaultSite',
                    'DisplayTimeZone' => 'UTC',
                ];
            }
        });

        $this->apiFor($user)
            ->getJson("/api/v1/tracking-providers/{$provider->uuid}/powerfleet/organisations?merchant_id={$merchant->uuid}")
            ->assertStatus(200)
            ->assertJsonPath('data.0.group_id', '-293601279')
            ->assertJsonPath('data.0.name', 'Main Organisation')
            ->assertJsonPath('data.0.type', 'OrganisationGroup')
            ->assertJsonPath('data.0.raw.GroupId', -293601279);

        $this->apiFor($user)
            ->getJson("/api/v1/tracking-providers/{$provider->uuid}/powerfleet/organisations/-293601279/subgroups?merchant_id={$merchant->uuid}")
            ->assertStatus(200)
            ->assertJsonPath('data.0.group_id', '123456')
            ->assertJsonPath('data.0.name', 'Depot A');

        $this->apiFor($user)
            ->getJson("/api/v1/tracking-providers/{$provider->uuid}/powerfleet/organisations/123456/details?merchant_id={$merchant->uuid}")
            ->assertStatus(200)
            ->assertJsonPath('data.group_id', '123456')
            ->assertJsonPath('data.name', 'Depot A')
            ->assertJsonPath('data.group_type', 'DefaultSite')
            ->assertJsonPath('data.raw.GroupType', 'DefaultSite');
    }

    public function test_powerfleet_organisations_require_activated_provider(): void
    {
        [$user, $merchant] = $this->createUserAndMerchant();

        $provider = TrackingProvider::create([
            'name' => 'Powerfleet',
            'status' => 'active',
        ]);

        $this->apiFor($user)
            ->getJson("/api/v1/tracking-providers/{$provider->uuid}/powerfleet/organisations?merchant_id={$merchant->uuid}")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_powerfleet_organisations_reject_disabled_provider(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedPowerfleetProvider([
            'status' => 'disabled',
        ]);

        $this->apiFor($user)
            ->getJson("/api/v1/tracking-providers/{$provider->uuid}/powerfleet/organisations?merchant_id={$merchant->uuid}")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_powerfleet_organisations_reject_non_powerfleet_provider(): void
    {
        [$user, $merchant] = $this->createUserAndMerchant();

        $provider = TrackingProvider::create([
            'name' => 'Fleetboard',
            'status' => 'active',
        ]);

        MerchantIntegration::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'provider_id' => $provider->id,
            'integration_data' => ['token' => 'abc'],
            'integration_options_data' => [],
        ]);

        $this->apiFor($user)
            ->getJson("/api/v1/tracking-providers/{$provider->uuid}/powerfleet/organisations?merchant_id={$merchant->uuid}")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    private function createActivatedPowerfleetProvider(array $overrides = []): array
    {
        [$user, $merchant] = $this->createUserAndMerchant();

        $provider = TrackingProvider::create(array_merge([
            'name' => 'Powerfleet',
            'status' => 'active',
        ], $overrides));

        MerchantIntegration::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'provider_id' => $provider->id,
            'integration_data' => [
                'username' => 'powerfleet-user',
                'organisation_id' => '-293601279',
            ],
            'integration_options_data' => [],
        ]);

        return [$user, $merchant, $provider];
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
