<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Driver;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\MerchantIntegration;
use App\Models\TrackingProvider;
use App\Models\TrackingProviderIntegrationFormField;
use App\Models\TrackingProviderOption;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleType;
use App\Jobs\ImportProviderVehiclesJob;
use App\Services\MerchantIntegrationService;
use App\Services\Mixtelematics\MixIntegrateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
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

    public function test_user_can_list_tracking_provider_vehicles_for_selection(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedVehicleImportProvider();

        $this->mockVehicleImportProvider([
            [
                'integration_id' => 'veh-002',
                'plate_number' => 'CA 456',
                'description' => 'Backup Truck',
                'make' => 'Volvo',
                'model' => 'FH',
            ],
            [
                'integration_id' => 'veh-001',
                'plate_number' => 'CA 123',
                'ref_code' => 'Primary Van',
                'make' => 'Ford',
                'model' => 'Transit',
            ],
        ]);

        $response = $this->apiFor($user)->getJson(
            "/api/v1/tracking-providers/{$provider->uuid}/vehicles?merchant_id={$merchant->uuid}"
        );

        $response->assertStatus(200)
            ->assertJsonPath('data.0.provider_vehicle_id', 'veh-001')
            ->assertJsonPath('data.0.description', 'Primary Van')
            ->assertJsonPath('data.1.provider_vehicle_id', 'veh-002');
    }

    public function test_vehicle_import_endpoint_queues_only_selected_vehicle_ids(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedVehicleImportProvider();
        $vehicleType = VehicleType::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'truck',
            'name' => 'Truck',
            'enabled' => true,
        ]);

        Queue::fake();

        $this->apiFor($user)->postJson("/api/v1/tracking-providers/{$provider->uuid}/import_vehicles", [
            'merchant_id' => $merchant->uuid,
            'vehicles' => [
                [
                    'provider_vehicle_id' => 'veh-001',
                    'vehicle_type_id' => $vehicleType->uuid,
                ],
                [
                    'provider_vehicle_id' => 'veh-003',
                    'vehicle_type_id' => $vehicleType->uuid,
                ],
            ],
        ])->assertStatus(202);

        Queue::assertPushed(ImportProviderVehiclesJob::class, function (ImportProviderVehiclesJob $job) use ($provider, $vehicleType) {
            return $job->queue === 'imports'
                && $job->providerUuid === $provider->uuid
                && $job->vehicles === [
                    [
                        'provider_vehicle_id' => 'veh-001',
                        'vehicle_type_id' => $vehicleType->id,
                        'vehicle_type_uuid' => $vehicleType->uuid,
                    ],
                    [
                        'provider_vehicle_id' => 'veh-003',
                        'vehicle_type_id' => $vehicleType->id,
                        'vehicle_type_uuid' => $vehicleType->uuid,
                    ],
                ];
        });
    }

    public function test_vehicle_import_service_only_imports_selected_provider_vehicle_ids(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedVehicleImportProvider();
        $vehicleType = VehicleType::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'van',
            'name' => 'Van',
            'enabled' => true,
        ]);

        $this->mockVehicleImportProvider([
            [
                'integration_id' => 'veh-001',
                'plate_number' => 'CA 123',
                'make' => 'Ford',
                'model' => 'Transit',
            ],
            [
                'integration_id' => 'veh-002',
                'plate_number' => 'CA 456',
                'make' => 'Volvo',
                'model' => 'FH',
            ],
        ]);

        $result = app(MerchantIntegrationService::class)->importProviderVehicles(
            $user,
            $provider->uuid,
            $merchant->uuid,
            [[
                'provider_vehicle_id' => 'veh-002',
                'vehicle_type_id' => $vehicleType->uuid,
            ]]
        );

        $this->assertSame(1, $result['imported_count']);
        $this->assertDatabaseHas('vehicles', [
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'intergration_id' => 'veh-002',
            'plate_number' => 'CA 456',
            'vehicle_type_id' => $vehicleType->id,
        ]);
        $this->assertDatabaseMissing('vehicles', [
            'account_id' => $merchant->account_id,
            'intergration_id' => 'veh-001',
        ]);
        $this->assertSame(1, Vehicle::query()->count());
    }

    public function test_vehicle_import_assigns_selected_merchant_to_legacy_unscoped_vehicle(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedVehicleImportProvider();
        $vehicleType = VehicleType::create([
            'uuid' => (string) Str::uuid(),
            'code' => 'pickup',
            'name' => 'Pickup',
            'enabled' => true,
        ]);

        $legacyVehicle = Vehicle::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $merchant->account_id,
            'merchant_id' => null,
            'intergration_id' => 'veh-legacy',
            'plate_number' => 'OLD 123',
            'is_active' => true,
        ]);

        $this->mockVehicleImportProvider([
            [
                'integration_id' => 'veh-legacy',
                'plate_number' => 'NEW 456',
                'make' => 'Toyota',
                'model' => 'Hilux',
            ],
        ]);

        app(MerchantIntegrationService::class)->importProviderVehicles(
            $user,
            $provider->uuid,
            $merchant->uuid,
            [[
                'provider_vehicle_id' => 'veh-legacy',
                'vehicle_type_id' => $vehicleType->uuid,
            ]]
        );

        $legacyVehicle->refresh();

        $this->assertSame($merchant->id, $legacyVehicle->merchant_id);
        $this->assertSame('NEW 456', $legacyVehicle->plate_number);
        $this->assertSame($vehicleType->id, $legacyVehicle->vehicle_type_id);
    }

    public function test_driver_import_assigns_selected_merchant_to_legacy_unscoped_driver(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedImportProviderWithCapabilities([
            'has_driver_importing' => true,
        ]);

        $legacyUser = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $merchant->account_id,
            'role' => 'driver',
            'email' => 'legacy-driver@example.com',
            'name' => 'Legacy Driver',
        ]));

        $legacyDriver = Driver::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $merchant->account_id,
            'merchant_id' => null,
            'user_id' => $legacyUser->id,
            'intergration_id' => 'drv-legacy',
            'is_active' => true,
        ]);

        $this->mockProviderService('import_drivers', [[
            'integration_id' => 'drv-legacy',
            'name' => 'Updated Legacy Driver',
            'email' => 'legacy-driver@example.com',
            'telephone' => '123456789',
            'is_active' => true,
        ]]);

        app(MerchantIntegrationService::class)->importProviderDrivers(
            $user,
            $provider->uuid,
            $merchant->uuid
        );

        $legacyDriver->refresh();
        $legacyUser->refresh();

        $this->assertSame($merchant->id, $legacyDriver->merchant_id);
        $this->assertSame('Updated Legacy Driver', $legacyUser->name);
    }

    public function test_location_import_assigns_selected_merchant_to_new_location(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedImportProviderWithCapabilities([
            'has_locations_importing' => true,
        ]);

        $this->mockProviderService('import_locations', [[
            'integration_id' => 'loc-new',
            'name' => 'Updated Yard',
            'code' => 'YARD-01',
            'address_line_1' => '1 Dock Road',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
        ]]);

        app(MerchantIntegrationService::class)->importProviderLocations(
            $user,
            $provider->uuid,
            $merchant->uuid,
            null
        );

        $this->assertDatabaseHas('locations', [
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'intergration_id' => 'loc-new',
            'name' => 'Updated Yard',
            'code' => 'YARD-01',
        ]);
    }

    public function test_user_can_inspect_mix_token_for_activated_provider(): void
    {
        [$user, $merchant] = $this->createUserAndMerchant();

        $provider = TrackingProvider::create([
            'name' => 'Powerfleet',
            'status' => 'active',
        ]);

        MerchantIntegration::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'provider_id' => $provider->id,
            'integration_data' => [
                'client_id' => 'client',
                'client_secret' => 'secret',
                'username' => 'mix-user',
                'password' => 'mix-password',
            ],
            'integration_options_data' => [],
        ]);

        app()->instance(MixIntegrateService::class, new class extends MixIntegrateService {
            public function inspectTokenResponse(array $integrationData = []): array
            {
                return [
                    'raw_response' => [
                        'access_token' => 'raw-access-token',
                        'refresh_token' => 'raw-refresh-token',
                        'token_type' => 'Bearer',
                        'expires_in' => 3600,
                    ],
                    'access_token' => 'raw-access-token',
                    'refresh_token' => 'raw-refresh-token',
                    'token_type' => 'Bearer',
                    'expires_in' => 3600,
                    'scope' => 'offline_access MiX.Integrate',
                    'access_token_masked' => 'raw-acce...oken',
                    'refresh_token_masked' => 'raw-refr...oken',
                    'access_token_decoded' => [
                        'decodable' => true,
                        'format' => 'jwt',
                        'claims' => ['sub' => 'mix-user'],
                    ],
                    'refresh_token_decoded' => [
                        'decodable' => false,
                        'format' => 'opaque',
                    ],
                    'timing' => [
                        'issued_at' => '2026-04-09T10:00:00+00:00',
                        'expires_at' => '2026-04-09T11:00:00+00:00',
                        'expires_in_seconds' => 3600,
                        'seconds_until_expiry' => 3600,
                        'is_expired' => false,
                    ],
                    'summary' => 'token_type=Bearer; scope=offline_access MiX.Integrate; Expires in 1h 0m 0s at 2026-04-09T11:00:00+00:00.',
                ];
            }
        });

        $response = $this->apiFor($user)->postJson("/api/v1/tracking-providers/{$provider->uuid}/mix-token-analysis", [
            'merchant_id' => $merchant->uuid,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.provider_id', $provider->uuid)
            ->assertJsonPath('data.merchant_id', $merchant->uuid)
            ->assertJsonPath('data.credential_source', 'stored_integration')
            ->assertJsonPath('data.access_token', 'raw-access-token')
            ->assertJsonPath('data.access_token_decoded.claims.sub', 'mix-user')
            ->assertJsonPath('data.timing.seconds_until_expiry', 3600);
    }

    public function test_mix_token_inspection_rejects_non_mix_provider(): void
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
            'integration_data' => ['username' => 'value'],
            'integration_options_data' => [],
        ]);

        $this->apiFor($user)->postJson("/api/v1/tracking-providers/{$provider->uuid}/mix-token-analysis", [
            'merchant_id' => $merchant->uuid,
        ])->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_mix_token_inspection_requires_activated_provider_integration(): void
    {
        [$user, $merchant] = $this->createUserAndMerchant();

        $provider = TrackingProvider::create([
            'name' => 'Powerfleet',
            'status' => 'active',
        ]);

        $this->apiFor($user)->postJson("/api/v1/tracking-providers/{$provider->uuid}/mix-token-analysis", [
            'merchant_id' => $merchant->uuid,
        ])->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    private function createActivatedVehicleImportProvider(): array
    {
        [$user, $merchant] = $this->createUserAndMerchant();

        $provider = TrackingProvider::create([
            'name' => 'Powerfleet',
            'status' => 'active',
            'has_vehicle_importing' => true,
        ]);

        MerchantIntegration::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'provider_id' => $provider->id,
            'integration_data' => ['api_key' => 'key-123'],
            'integration_options_data' => [],
        ]);

        return [$user, $merchant, $provider];
    }

    private function createActivatedImportProviderWithCapabilities(array $capabilities): array
    {
        [$user, $merchant] = $this->createUserAndMerchant();

        $provider = TrackingProvider::create(array_merge([
            'name' => 'Powerfleet',
            'status' => 'active',
            'has_vehicle_importing' => false,
            'has_driver_importing' => false,
            'has_locations_importing' => false,
        ], $capabilities));

        MerchantIntegration::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'provider_id' => $provider->id,
            'integration_data' => ['api_key' => 'key-123'],
            'integration_options_data' => [],
        ]);

        return [$user, $merchant, $provider];
    }

    private function mockVehicleImportProvider(array $payload): void
    {
        app()->instance(MixIntegrateService::class, new class($payload) extends MixIntegrateService {
            public function __construct(private array $payload)
            {
            }

            public function list_importable_vehicles(array $integrationData = [], array $integrationOptionsData = []): array
            {
                return $this->payload;
            }

            public function import_vehicles(array $integrationData = [], array $integrationOptionsData = []): array
            {
                return $this->payload;
            }
        });
    }

    private function mockProviderService(string $method, array $payload): void
    {
        app()->instance(MixIntegrateService::class, new class($method, $payload) extends MixIntegrateService {
            public function __construct(
                private string $methodName,
                private array $payload
            ) {
            }

            public function __call(string $name, array $arguments): mixed
            {
                if ($name === $this->methodName) {
                    return $this->payload;
                }

                return parent::__call($name, $arguments);
            }

            public function import_drivers(array $integrationData = [], array $integrationOptionsData = []): array
            {
                return $this->methodName === 'import_drivers' ? $this->payload : [];
            }

            public function import_locations(array $integrationData = [], array $integrationOptionsData = []): array
            {
                return $this->methodName === 'import_locations' ? $this->payload : [];
            }
        });
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
