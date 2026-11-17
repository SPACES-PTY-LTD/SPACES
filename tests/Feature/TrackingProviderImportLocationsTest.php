<?php

namespace Tests\Feature;

use App\Jobs\ImportProviderLocationsJob;
use App\Models\Account;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\MerchantIntegration;
use App\Models\TrackingProvider;
use App\Models\User;
use App\Services\MerchantIntegrationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Mockery;
use Tests\TestCase;

class TrackingProviderImportLocationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_list_provider_locations_endpoint_returns_preview_rows(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedLocationImportProvider();

        $response = $this->apiFor($user)->getJson(
            "/api/v1/tracking-providers/{$provider->uuid}/locations?merchant_id={$merchant->uuid}"
        );

        $response->assertOk()
            ->assertJsonPath('data.0.provider_location_id', 'loc-001')
            ->assertJsonPath('data.0.name', 'Alpha Depot')
            ->assertJsonPath('data.0.has_geofence', true)
            ->assertJsonPath('data.1.provider_location_id', 'loc-002')
            ->assertJsonPath('data.1.city', 'Johannesburg');
    }

    public function test_import_locations_endpoint_queues_only_selected_location_ids(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedLocationImportProvider();
        Queue::fake();

        $response = $this->apiFor($user)->postJson("/api/v1/tracking-providers/{$provider->uuid}/import_locations", [
            'merchant_id' => $merchant->uuid,
            'locations' => [
                ['provider_location_id' => 'loc-001'],
                ['provider_location_id' => 'loc-003'],
            ],
        ]);

        $response->assertStatus(202)
            ->assertJsonPath('data.queued', true)
            ->assertJsonPath('data.already_in_progress', false);

        Queue::assertPushed(ImportProviderLocationsJob::class, function (ImportProviderLocationsJob $job) use ($user, $merchant, $provider) {
            return $job->userId === $user->id
                && $job->merchantId === $merchant->id
                && $job->merchantUuid === $merchant->uuid
                && $job->providerUuid === $provider->uuid
                && $job->locations === [
                    ['provider_location_id' => 'loc-001'],
                    ['provider_location_id' => 'loc-003'],
                ];
        });
    }

    public function test_location_import_job_passes_selected_locations_to_service(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedLocationImportProvider();
        $locations = [
            ['provider_location_id' => 'loc-001'],
        ];
        $job = new ImportProviderLocationsJob(
            $user->id,
            $merchant->id,
            $merchant->uuid,
            $provider->uuid,
            null,
            $locations
        );

        $service = Mockery::mock(MerchantIntegrationService::class);
        $service->shouldReceive('claimLocationImport')->once()->with($merchant->id, null)->andReturn(true);
        $service->shouldReceive('importProviderLocations')
            ->once()
            ->with(
                Mockery::on(fn ($actual) => $actual instanceof User && $actual->is($user)),
                $provider->uuid,
                $merchant->uuid,
                null,
                $locations
            )
            ->andReturn(['imported_count' => 1]);
        $service->shouldReceive('completeImportByMerchantId')
            ->once()
            ->with($merchant->id, 'locations', 1, null, null);

        $job->handle($service);
    }

    public function test_import_provider_locations_persists_only_selected_locations(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedLocationImportProvider();

        $result = app(MerchantIntegrationService::class)->importProviderLocations(
            $user,
            $provider->uuid,
            $merchant->uuid,
            null,
            [
                ['provider_location_id' => 'loc-002'],
            ]
        );

        $this->assertSame(1, $result['imported_count']);
        $this->assertDatabaseHas('locations', [
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'intergration_id' => 'loc-002',
            'name' => 'Beta Warehouse',
        ]);
        $this->assertDatabaseMissing('locations', [
            'account_id' => $merchant->account_id,
            'intergration_id' => 'loc-001',
        ]);
        $this->assertSame(1, Location::query()->where('account_id', $merchant->account_id)->count());
    }

    public function test_import_locations_endpoint_returns_error_when_not_supported(): void
    {
        [$user, $merchant, $account] = $this->createUserMerchantAccount();

        $provider = TrackingProvider::create([
            'name' => 'Fake No Locations Provider',
            'status' => 'active',
            'has_locations_importing' => false,
        ]);

        config()->set('tracking_providers.services.fake-no-locations-provider', FakeNoLocationImportProviderService::class);

        MerchantIntegration::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'provider_id' => $provider->id,
            'integration_data' => ['token' => 'abc'],
        ]);

        $response = $this->apiFor($user)->postJson("/api/v1/tracking-providers/{$provider->uuid}/import_locations", [
            'merchant_id' => $merchant->uuid,
            'locations' => [
                ['provider_location_id' => 'loc-001'],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_stale_location_import_is_replaced_but_recent_import_is_not(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedLocationImportProvider();
        Queue::fake();
        $merchant->update(['imports_stats' => [
            'inprogress' => ['locations' => now()->subDays(2)->format('Y-m-d H:i:s')],
            'last_import_counts' => ['locations' => 3155, 'drivers' => 333],
        ]]);
        $service = app(MerchantIntegrationService::class);
        $result = $service->queueProviderLocationsImport($user, $provider->uuid, $merchant->uuid, null, [['provider_location_id' => 'loc-001']]);
        $this->assertTrue($result['queued']);
        $token = $result['stats']['location_import_token'];
        $this->assertNotEmpty($token);
        $this->assertSame(3155, $result['stats']['last_import_counts']['locations']);
        $this->assertSame(333, $result['stats']['last_import_counts']['drivers']);
        $second = $service->queueProviderLocationsImport($user, $provider->uuid, $merchant->uuid);
        $this->assertTrue($second['already_in_progress']);
        Queue::assertPushed(ImportProviderLocationsJob::class, 1);
        Queue::assertPushed(ImportProviderLocationsJob::class, fn ($job) => $job->importToken === $token && $job->queue === 'imports');
    }

    public function test_invalid_legacy_timestamp_can_be_recovered(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedLocationImportProvider();
        Queue::fake();
        $merchant->update(['imports_stats' => ['inprogress' => ['locations' => 'invalid timestamp']]]);
        $this->assertTrue(app(MerchantIntegrationService::class)->queueProviderLocationsImport(
            $user, $provider->uuid, $merchant->uuid
        )['queued']);
    }

    public function test_legacy_job_cannot_claim_a_new_or_completed_import(): void
    {
        [, $merchant] = $this->createActivatedLocationImportProvider();
        $service = app(MerchantIntegrationService::class);
        $this->assertFalse($service->claimLocationImport($merchant->id, null));
        $merchant->update(['imports_stats' => [
            'inprogress' => ['locations' => now()->toDateTimeString()],
            'location_import_token' => 'new-token',
        ]]);
        $this->assertFalse($service->claimLocationImport($merchant->id, null));
        $service->completeImportByMerchantId($merchant->id, 'locations', null, 'Legacy failure');
        $this->assertSame('new-token', $merchant->fresh()->imports_stats['location_import_token']);
    }

    public function test_superseded_job_cannot_run_or_clear_new_import(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedLocationImportProvider();
        $merchant->update(['imports_stats' => [
            'inprogress' => ['locations' => now()->toDateTimeString()],
            'location_import_token' => 'new-token',
        ]]);
        $service = app(MerchantIntegrationService::class);
        $job = new ImportProviderLocationsJob($user->id, $merchant->id, $merchant->uuid, $provider->uuid, null, [], 'old-token');
        $job->handle($service);
        $job->failed(new \RuntimeException('Old failure'));
        $service->completeImportByMerchantId($merchant->id, 'locations', 99, null, 'old-token');
        $this->assertSame('new-token', $merchant->fresh()->imports_stats['location_import_token']);
        $this->assertDatabaseCount('locations', 0);
    }

    public function test_worker_failure_releases_matching_lock_and_records_error(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedLocationImportProvider();
        Queue::fake();
        $service = app(MerchantIntegrationService::class);
        $result = $service->queueProviderLocationsImport($user, $provider->uuid, $merchant->uuid);
        $job = new ImportProviderLocationsJob($user->id, $merchant->id, $merchant->uuid, $provider->uuid, null, [], $result['stats']['location_import_token']);
        $job->failed(new \RuntimeException('Import timed out'));
        $stats = $merchant->fresh()->imports_stats;
        $this->assertNull($stats['inprogress']['locations']);
        $this->assertNull($stats['location_import_token']);
        $this->assertSame('Import timed out', $stats['last_import_errors']['locations']);
        $this->assertTrue($job->failOnTimeout);
        $this->assertSame(300, $job->timeout);
    }

    public function test_dispatch_failure_releases_location_import_lock(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedLocationImportProvider();
        \Illuminate\Support\Facades\Bus::shouldReceive('dispatch')->once()->andThrow(new \RuntimeException('Queue unavailable'));
        try {
            app(MerchantIntegrationService::class)->queueProviderLocationsImport($user, $provider->uuid, $merchant->uuid);
            $this->fail('Expected queue failure');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Queue unavailable', $exception->getMessage());
        }
        $stats = $merchant->fresh()->imports_stats;
        $this->assertNull($stats['inprogress']['locations']);
        $this->assertSame('Queue unavailable', $stats['last_import_errors']['locations']);
    }

    public function test_claim_renews_lock_and_success_clears_it(): void
    {
        [$user, $merchant, $provider] = $this->createActivatedLocationImportProvider();
        Queue::fake();
        $service = app(MerchantIntegrationService::class);
        $result = $service->queueProviderLocationsImport($user, $provider->uuid, $merchant->uuid, null, [['provider_location_id' => 'loc-001']]);
        $token = $result['stats']['location_import_token'];
        $this->travel(23)->hours();
        $this->assertTrue($service->claimLocationImport($merchant->id, $token));
        $this->travel(2)->hours();
        $this->assertTrue($service->queueProviderLocationsImport($user, $provider->uuid, $merchant->uuid)['already_in_progress']);
        $job = new ImportProviderLocationsJob($user->id, $merchant->id, $merchant->uuid, $provider->uuid, null, [['provider_location_id' => 'loc-001']], $token);
        $job->handle($service);
        $stats = $merchant->fresh()->imports_stats;
        $this->assertNull($stats['inprogress']['locations']);
        $this->assertSame(1, $stats['last_import_counts']['locations']);
        $job->failed(new \RuntimeException('Late failure'));
        $this->assertNull($merchant->fresh()->imports_stats['last_import_errors']['locations']);
    }

    private function createActivatedLocationImportProvider(): array
    {
        [$user, $merchant, $account] = $this->createUserMerchantAccount();

        $provider = TrackingProvider::create([
            'name' => 'Fake Selective Location Provider',
            'status' => 'active',
            'has_locations_importing' => true,
        ]);

        config()->set('tracking_providers.services.fake-selective-location-provider', FakeSelectiveLocationProviderService::class);

        MerchantIntegration::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'provider_id' => $provider->id,
            'integration_data' => ['token' => 'abc'],
        ]);

        return [$user, $merchant, $provider];
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

class FakeSelectiveLocationProviderService
{
    public function import_locations(array $integrationData = [], array $integrationOptionsData = []): array
    {
        return [
            [
                'integration_id' => 'loc-002',
                'name' => 'Beta Warehouse',
                'code' => 'BETA',
                'company' => 'Beta Logistics',
                'full_address' => '2 Beta Road',
                'city' => 'Johannesburg',
                'province' => 'Gauteng',
                'country' => 'South Africa',
                'latitude' => -26.2041,
                'longitude' => 28.0473,
            ],
            [
                'integration_id' => 'loc-001',
                'name' => 'Alpha Depot',
                'code' => 'ALPHA',
                'company' => 'Alpha Logistics',
                'full_address' => '1 Alpha Road',
                'city' => 'Cape Town',
                'province' => 'Western Cape',
                'country' => 'South Africa',
                'latitude' => -33.9249,
                'longitude' => 18.4241,
                'polygon_bounds' => 'POLYGON((18 -33, 18 -34, 19 -34, 19 -33, 18 -33))',
            ],
            [
                'integration_id' => 'loc-003',
                'name' => 'Gamma Yard',
                'code' => 'GAMMA',
                'city' => 'Durban',
                'province' => 'KwaZulu-Natal',
                'country' => 'South Africa',
            ],
        ];
    }
}

class FakeNoLocationImportProviderService
{
}
