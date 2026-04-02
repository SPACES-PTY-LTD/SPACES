<?php

namespace Tests\Feature;

use App\Jobs\TrackVehicleLocationsJob;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Driver;
use App\Models\Merchant;
use App\Models\MerchantIntegration;
use App\Models\TrackingProvider;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\ActivityLogService;
use App\Services\AutoRunLifecycleService;
use App\Services\DriverService;
use App\Services\DriverVehicleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class TrackVehicleLocationsJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_auto_creates_missing_driver_from_single_provider_fetch_and_assigns_vehicle(): void
    {
        FakeDriverSingleProviderService::reset();
        FakeDriverSingleProviderService::$positions = [[
            'vehicle_integration_id' => 'veh-123',
            'driver_integration_id' => 'drv-123',
            'timestamp' => '2026-04-02T10:00:00Z',
            'latitude' => -33.9200,
            'longitude' => 18.4200,
            'speed_kilometres_per_hour' => 40,
        ]];
        FakeDriverSingleProviderService::$singleDriver = [
            'integration_id' => 'drv-123',
            'name' => 'Jane Track',
            'email' => 'jane.track@example.com',
            'telephone' => '+27110000001',
            'is_active' => true,
        ];

        [$merchant, $integration, $vehicle] = $this->createTrackingContext(
            providerName: 'Fake Driver Single Provider',
            serviceClass: FakeDriverSingleProviderService::class,
        );

        $this->runTrackingJob($integration, $vehicle);

        $driver = Driver::query()
            ->where('merchant_id', $merchant->id)
            ->where('intergration_id', 'drv-123')
            ->first();

        $this->assertNotNull($driver);
        $this->assertSame('Jane Track', $driver->user?->name);
        $this->assertDatabaseHas('driver_vehicles', [
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
        ]);

        $vehicle->refresh();
        $this->assertSame($driver->id, $vehicle->last_driver_id);

        $activity = ActivityLog::query()
            ->where('action', 'tracking_driver_imported')
            ->latest('id')
            ->first();

        $this->assertNotNull($activity);
        $this->assertSame('single', $activity->metadata['fetch_method'] ?? null);
    }

    public function test_it_falls_back_to_bulk_driver_import_when_single_fetch_is_unavailable(): void
    {
        FakeDriverBulkFallbackProviderService::reset();
        FakeDriverBulkFallbackProviderService::$positions = [[
            'vehicle_integration_id' => 'veh-123',
            'driver_integration_id' => 'drv-bulk',
            'timestamp' => '2026-04-02T10:05:00Z',
            'latitude' => -33.9200,
            'longitude' => 18.4200,
            'speed_kilometres_per_hour' => 35,
        ]];
        FakeDriverBulkFallbackProviderService::$bulkDrivers = [
            [
                'integration_id' => 'drv-other',
                'name' => 'Other Driver',
                'email' => 'other@example.com',
                'telephone' => '+27110000009',
                'is_active' => true,
            ],
            [
                'integration_id' => 'drv-bulk',
                'name' => 'Bulk Driver',
                'email' => 'bulk.driver@example.com',
                'telephone' => '+27110000002',
                'is_active' => true,
            ],
        ];

        [$merchant, $integration, $vehicle] = $this->createTrackingContext(
            providerName: 'Fake Driver Bulk Provider',
            serviceClass: FakeDriverBulkFallbackProviderService::class,
        );

        $this->runTrackingJob($integration, $vehicle);

        $driver = Driver::query()
            ->where('merchant_id', $merchant->id)
            ->where('intergration_id', 'drv-bulk')
            ->first();

        $this->assertNotNull($driver);
        $this->assertSame('Bulk Driver', $driver->user?->name);

        $activity = ActivityLog::query()
            ->where('action', 'tracking_driver_imported')
            ->latest('id')
            ->first();

        $this->assertNotNull($activity);
        $this->assertSame('bulk_fallback', $activity->metadata['fetch_method'] ?? null);
    }

    public function test_it_continues_tracking_when_missing_driver_import_fails(): void
    {
        FakeDriverSingleProviderService::reset();
        FakeDriverSingleProviderService::$positions = [[
            'vehicle_integration_id' => 'veh-123',
            'driver_integration_id' => 'drv-fail',
            'timestamp' => '2026-04-02T10:10:00Z',
            'latitude' => -33.9200,
            'longitude' => 18.4200,
            'speed_kilometres_per_hour' => 30,
        ]];
        FakeDriverSingleProviderService::$throwOnSingle = true;

        [$merchant, $integration, $vehicle] = $this->createTrackingContext(
            providerName: 'Fake Driver Single Provider',
            serviceClass: FakeDriverSingleProviderService::class,
        );

        $this->runTrackingJob($integration, $vehicle);

        $this->assertDatabaseMissing('drivers', [
            'merchant_id' => $merchant->id,
            'intergration_id' => 'drv-fail',
        ]);

        $vehicle->refresh();
        $this->assertNotNull($vehicle->location_updated_at);
        $this->assertNull($vehicle->last_driver_id);

        $activity = ActivityLog::query()
            ->where('action', 'tracking_driver_import_failed')
            ->latest('id')
            ->first();

        $this->assertNotNull($activity);
        $this->assertSame('drv-fail', $activity->metadata['driver_integration_id'] ?? null);
    }

    public function test_it_auto_creates_missing_driver_under_the_correct_merchant_when_integration_ids_collide(): void
    {
        FakeDriverSingleProviderService::reset();
        FakeDriverSingleProviderService::$positions = [[
            'vehicle_integration_id' => 'veh-123',
            'driver_integration_id' => 'drv-collision',
            'timestamp' => '2026-04-02T10:15:00Z',
            'latitude' => -33.9200,
            'longitude' => 18.4200,
            'speed_kilometres_per_hour' => 28,
        ]];
        FakeDriverSingleProviderService::$singleDriver = [
            'integration_id' => 'drv-collision',
            'name' => 'Right Merchant Driver',
            'email' => 'right.merchant@example.com',
            'telephone' => '+27110000003',
            'is_active' => true,
        ];

        [$merchant, $integration, $vehicle, $account, $owner] = $this->createTrackingContext(
            providerName: 'Fake Driver Single Provider',
            serviceClass: FakeDriverSingleProviderService::class,
            includeOwner: true,
        );

        $otherMerchant = Merchant::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'owner_user_id' => $owner->id,
            'name' => 'Other Merchant',
            'legal_name' => 'Other Merchant LLC',
            'status' => 'active',
            'timezone' => 'UTC',
            'operating_countries' => ['US'],
        ]);

        $otherDriverUser = User::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'name' => 'Wrong Merchant Driver',
            'email' => 'wrong.merchant@example.com',
            'password' => 'password',
            'role' => 'driver',
        ]);

        $wrongDriver = Driver::create([
            'account_id' => $account->id,
            'merchant_id' => $otherMerchant->id,
            'user_id' => $otherDriverUser->id,
            'intergration_id' => 'drv-collision',
            'is_active' => true,
        ]);

        $this->runTrackingJob($integration, $vehicle);

        $driver = Driver::query()
            ->where('merchant_id', $merchant->id)
            ->where('intergration_id', 'drv-collision')
            ->first();

        $this->assertNotNull($driver);
        $this->assertNotSame($wrongDriver->id, $driver->id);

        $vehicle->refresh();
        $this->assertSame($driver->id, $vehicle->last_driver_id);
    }

    private function createTrackingContext(
        string $providerName,
        string $serviceClass,
        bool $includeOwner = false
    ): array {
        config()->set('tracking_providers.services.'.Str::slug($providerName), $serviceClass);

        $owner = User::create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Owner User',
            'email' => 'owner+'.Str::lower(Str::random(6)).'@example.com',
            'password' => 'password',
            'role' => 'user',
        ]);

        $account = Account::create(['owner_user_id' => $owner->id]);
        $owner->forceFill(['account_id' => $account->id])->save();

        $merchant = Merchant::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'owner_user_id' => $owner->id,
            'name' => 'Test Merchant',
            'legal_name' => 'Test Merchant LLC',
            'status' => 'active',
            'timezone' => 'UTC',
            'operating_countries' => ['US'],
            'allow_auto_shipment_creations_at_locations' => false,
        ]);

        $provider = TrackingProvider::create([
            'uuid' => (string) Str::uuid(),
            'name' => $providerName,
            'status' => 'active',
        ]);

        $integration = MerchantIntegration::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'provider_id' => $provider->id,
            'integration_data' => ['token' => 'abc'],
        ]);

        $vehicle = Vehicle::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => 'TEST-123',
            'is_active' => true,
            'intergration_id' => 'veh-123',
        ]);

        if ($includeOwner) {
            return [$merchant, $integration, $vehicle, $account, $owner];
        }

        return [$merchant, $integration, $vehicle];
    }

    private function runTrackingJob(MerchantIntegration $integration, Vehicle $vehicle): void
    {
        $job = new TrackVehicleLocationsJob($integration->id, [$vehicle->id]);
        $job->handle(
            app(ActivityLogService::class),
            app(AutoRunLifecycleService::class),
            app(DriverVehicleService::class),
            app(DriverService::class),
        );
    }
}

class FakeDriverSingleProviderService
{
    public static array $positions = [];
    public static ?array $singleDriver = null;
    public static bool $throwOnSingle = false;

    public static function reset(): void
    {
        self::$positions = [];
        self::$singleDriver = null;
        self::$throwOnSingle = false;
    }

    public function getVehiclePositions(array $assetIds, array $integrationData = []): array
    {
        return self::$positions;
    }

    public function import_driver_by_integration_id(
        array $integrationData = [],
        string $driverIntegrationId = '',
        array $integrationOptionsData = []
    ): ?array {
        if (self::$throwOnSingle) {
            throw new \RuntimeException('Provider fetch failed.');
        }

        if ((self::$singleDriver['integration_id'] ?? null) !== $driverIntegrationId) {
            return null;
        }

        return self::$singleDriver;
    }
}

class FakeDriverBulkFallbackProviderService
{
    public static array $positions = [];
    public static array $bulkDrivers = [];

    public static function reset(): void
    {
        self::$positions = [];
        self::$bulkDrivers = [];
    }

    public function getVehiclePositions(array $assetIds, array $integrationData = []): array
    {
        return self::$positions;
    }

    public function import_drivers(array $integrationData = [], array $integrationOptionsData = []): array
    {
        return self::$bulkDrivers;
    }
}
