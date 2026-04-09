<?php

namespace App\Jobs;

use App\Models\Driver;
use App\Models\MerchantIntegration;
use App\Models\TrackingProvider;
use App\Models\Vehicle;
use App\Services\ActivityLogService;
use App\Services\AutoRunLifecycleService;
use App\Services\DriverService;
use App\Services\DriverVehicleService;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class TrackVehicleLocationsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * @param  array<int>  $vehicleIds
     */
    public function __construct(
        public int $merchantIntegrationId,
        public array $vehicleIds
    ) {
    }

    public function handle(
        ActivityLogService $activityLogService,
        AutoRunLifecycleService $autoRunLifecycleService,
        DriverVehicleService $driverVehicleService,
        DriverService $driverService
    ): void
    {
        $integration = null;
        $provider = null;
        $result = 'completed';
        $exitReason = 'success';
        $matchedPositions = 0;
        $updatedVehicles = 0;
        $vehiclesChecked = 0;
        $vehiclesInsideGeofence = 0;

        try {
            $integration = MerchantIntegration::with(['provider', 'merchant'])->find($this->merchantIntegrationId);
            if (!$integration || !$integration->provider) {
                $exitReason = 'missing_integration_or_provider';
                return;
            }

            $provider = $integration->provider;
            $service = $this->resolveProviderService($provider);
            if (!$service) {
                $exitReason = 'missing_provider_service';
                return;
            }
            
            Log::info('Starting vehicle location tracking job.', [
                'merchant_integration_id' => $integration->id,
                'provider_id' => $provider->id,
                'vehicle_ids' => $this->vehicleIds,
            ]);
            

            $vehicles = Vehicle::query()
                ->whereIn('id', $this->vehicleIds)
                ->whereNotNull('intergration_id')
                ->get();


            if ($vehicles->isEmpty()) {
                $exitReason = 'no_vehicles_to_sync';
                return;
            }

            $assetIds = $vehicles->pluck('intergration_id')->filter()->values()->all();
            if (empty($assetIds)) {
                $exitReason = 'no_asset_ids';
                return;
            }

            $positions = $service->getVehiclePositions($assetIds, $integration->integration_data ?? []);
            $positionsByAsset = $this->normalizePositions($positions, $assetIds);

            foreach ($vehicles as $vehicle) {
                $assetId = $vehicle->intergration_id;
       
                if (!$assetId) {
                    continue;
                }

                $position = $positionsByAsset[$assetId] ?? null;
                if (!$position) {
                    continue;
                }
                $vehiclesChecked++;
                $matchedPositions++;

                $timestamp = $this->extractTimestamp($position) ?? now();
                $latitude = $this->extractLatitude($position);
                $longitude = $this->extractLongitude($position);
                $speedKilometresPerHour = $this->extractSpeedKilometresPerHour($position);
                $speedLimit = $this->extractSpeedLimit($position);
                $driverIntegrationId = $this->extractDriverIntegrationId($position);
                $odometerKilometres = $this->extractOdometerKilometres($position);

                $args = [
                    'last_location_address' => $this->extractAddress($position) ?? $vehicle->last_location_address,
                    'location_updated_at' => $timestamp,
                    'odometer' => $this->extractOdometer($position) ?? $vehicle->odometer,
                    'metadata' => $this->mergeMetadata($vehicle->metadata, [
                        'tracking_provider' => $provider->name,
                        'tracking_position' => $position,
                    ]),
                ];

                $vehicle->forceFill($args)->save();
                $updatedVehicles++;

                $this->syncDetectedDriver(
                    vehicle: $vehicle,
                    merchantIntegration: $integration,
                    provider: $provider,
                    providerService: $service,
                    driverIntegrationId: $driverIntegrationId,
                    driverVehicleService: $driverVehicleService,
                    driverService: $driverService,
                    activityLogService: $activityLogService,
                );

                if ($integration->merchant) {
                    $insideGeofence = $autoRunLifecycleService->processVehiclePosition(
                        vehicle: $vehicle,
                        merchant: $integration->merchant,
                        latitude: $latitude,
                        longitude: $longitude,
                        eventAt: $timestamp,
                        speedKph: $speedKilometresPerHour,
                        speedLimitKph: $speedLimit,
                        odometerKilometres: $odometerKilometres,
                        driverIntegrationId: $driverIntegrationId,
                        providerPosition: $position,
                    );

                    if ($insideGeofence) {
                        $vehiclesInsideGeofence++;
                    }
                }
            }

            Log::info('Vehicle geofence check summary.', [
                'merchant_integration_id' => $integration->id,
                'provider_id' => $provider->id,
                'vehicles_checked' => $vehiclesChecked,
                'vehicles_inside_geofence' => $vehiclesInsideGeofence,
            ]);
        } catch (\Throwable $exception) {
            $result = 'failed';
            $exitReason = 'exception';
            $activityLogService->log(
                action: 'vehicle_location_tracking_failed',
                entityType: 'merchant_integration',
                entity: $integration,
                accountId: $integration?->account_id,
                merchantId: $integration?->merchant_id,
                title: 'Vehicle location tracking job failed due to exception',
                metadata: [
                    'merchant_integration_id' => $this->merchantIntegrationId,
                    'provider_id' => $provider?->id,
                    'vehicle_ids_requested' => $this->vehicleIds,
                    'vehicle_count_requested' => count($this->vehicleIds),
                    'vehicles_with_positions' => $matchedPositions,
                    'vehicles_updated' => $updatedVehicles,
                    'vehicles_checked_for_geofence' => $vehiclesChecked,
                    'vehicles_inside_geofence' => $vehiclesInsideGeofence,
                    'result' => $result,
                    'reason' => $exitReason,
                    'exception_message' => $exception->getMessage(),
                    'exception_trace' => $exception->getTraceAsString(),
                ]
            );
            throw $exception;
        } finally {
            // $activityLogService->log(
            //     action: $result,
            //     entityType: 'merchant_integration',
            //     entity: $integration,
            //     accountId: $integration?->account_id,
            //     merchantId: $integration?->merchant_id,
            //     title: $result === 'completed'
            //         ? 'Vehicle location tracking job completed'
            //         : 'Vehicle location tracking job failed',
            //     metadata: [
            //         'merchant_integration_id' => $this->merchantIntegrationId,
            //         'provider_id' => $provider?->id,
            //         'vehicle_ids_requested' => $this->vehicleIds,
            //         'vehicle_count_requested' => count($this->vehicleIds),
            //         'vehicles_with_positions' => $matchedPositions,
            //         'vehicles_updated' => $updatedVehicles,
            //         'vehicles_checked_for_geofence' => $vehiclesChecked,
            //         'vehicles_inside_geofence' => $vehiclesInsideGeofence,
            //         'result' => $result,
            //         'reason' => $exitReason,
            //     ]
            // );
        }
    }

    private function resolveProviderService(TrackingProvider $provider): ?object
    {
        $key = Str::slug($provider->name);
        $serviceClass = config("tracking_providers.services.{$key}");

        Log::warning('serviceClass', [
            'serviceClass' => $serviceClass,
            'key' => $key,
        ]);

        if (!$serviceClass || !class_exists($serviceClass)) {
            Log::warning('Tracking provider service class not configured..', [
                'provider_id' => $provider->id,
                'provider_name' => $provider->name,
                'service_key' => $key,
            ]);

            return null;
        }

        return app($serviceClass);
    }

    private function normalizePositions($positions, array $assetIds): array
    {
        if (!is_array($positions)) {
            return [];
        }

        $list = $positions['positions'] ?? $positions['Positions'] ?? $positions['data'] ?? $positions;
        if (!is_array($list)) {
            return [];
        }
        if (!array_is_list($list)) {
            $list = [$list];
        }

        $normalized = [];
        foreach (array_values($list) as $index => $item) {
            if (!is_array($item)) {
                continue;
            }

            $assetId = $item['vehicle_integration_id'] ?? $item['assetId'] ?? $item['asset_id'] ?? $item['assetID'] ?? null;
            if (!$assetId && isset($assetIds[$index])) {
                $assetId = $assetIds[$index];
            }

            if (!$assetId) {
                continue;
            }

            $normalized[$assetId] = $item;
        }

        return $normalized;
    }

    private function extractTimestamp(array $position): ?Carbon
    {
        $timestamp = $position['timestamp']
            ?? $position['recorded_at']
            ?? $position['recordedAt']
            ?? Arr::get($position, 'position.timestamp');

        if (!$timestamp) {
            return null;
        }

        try {
            return Carbon::parse($timestamp);
        } catch (\Throwable $exception) {
            return null;
        }
    }

    private function extractAddress(array $position): ?array
    {
        $address = $position['address']
            ?? $position['formatted_address']
            ?? $position['FormattedAddress']
            ?? Arr::get($position, 'position.address');

        if (is_array($address)) {
            return $address;
        }

        if (is_string($address) && $address !== '') {
            return ['address_line_1' => $address];
        }

        $lat = $position['latitude'] ?? Arr::get($position, 'position.latitude');
        $lng = $position['longitude'] ?? Arr::get($position, 'position.longitude');

        if ($lat !== null || $lng !== null) {
            return array_filter([
                'latitude' => is_numeric($lat) ? (float) $lat : $lat,
                'longitude' => is_numeric($lng) ? (float) $lng : $lng,
            ], static fn ($value) => $value !== null);
        }

        return null;
    }

    private function extractOdometer(array $position): ?int
    {
        $value = $position['odometer']
            ?? $position['odometer_kilometres']
            ?? $position['Odometer']
            ?? $position['OdometerKilometres']
            ?? Arr::get($position, 'position.odometer');

        if (!is_numeric($value)) {
            return null;
        }

        return (int) round((float) $value);
    }

    private function extractOdometerKilometres(array $position): ?float
    {
        $value = $position['odometer_kilometres']
            ?? $position['odometer']
            ?? $position['OdometerKilometres']
            ?? $position['Odometer']
            ?? Arr::get($position, 'position.odometer');

        return is_numeric($value) ? (float) $value : null;
    }

    private function extractSpeedKilometresPerHour(array $position): ?float
    {
        $value = $position['speed_kilometres_per_hour']
            ?? $position['speed']
            ?? $position['SpeedKilometresPerHour']
            ?? Arr::get($position, 'position.speed_kilometres_per_hour')
            ?? Arr::get($position, 'position.speed');

        return is_numeric($value) ? (float) $value : null;
    }

    private function extractSpeedLimit(array $position): ?float
    {
        $value = $position['speed_limit']
            ?? $position['speed_limit_kph']
            ?? $position['SpeedLimit']
            ?? Arr::get($position, 'position.speed_limit')
            ?? Arr::get($position, 'position.speed_limit_kph');

        return is_numeric($value) ? (float) $value : null;
    }

    private function extractDriverIntegrationId(array $position): ?string
    {
        $value = $position['driver_integration_id']
            ?? $position['DriverIntegrationId']
            ?? $position['driverId']
            ?? $position['DriverId']
            ?? $position['driver_id']
            ?? $position['DriverID']
            ?? Arr::get($position, 'position.driver_integration_id')
            ?? Arr::get($position, 'position.driverId')
            ?? Arr::get($position, 'position.driver_id');

        if ($value === null || $value === '') {
            return null;
        }

        return (string) $value;
    }

    private function syncDetectedDriver(
        Vehicle $vehicle,
        MerchantIntegration $merchantIntegration,
        TrackingProvider $provider,
        object $providerService,
        ?string $driverIntegrationId,
        DriverVehicleService $driverVehicleService,
        DriverService $driverService,
        ActivityLogService $activityLogService
    ): void {
        if (!$merchantIntegration->merchant || blank($driverIntegrationId)) {
            return;
        }

        $driver = $this->findDriverByIntegrationId($merchantIntegration, $driverIntegrationId);

        if (!$driver) {
            $driver = $this->importMissingDriver(
                merchantIntegration: $merchantIntegration,
                provider: $provider,
                providerService: $providerService,
                driverIntegrationId: $driverIntegrationId,
                driverService: $driverService,
                activityLogService: $activityLogService,
            );
        }

        if (!$driver) {
            return;
        }

        DB::transaction(function () use ($driver, $vehicle, $driverVehicleService) {
            $driver = Driver::query()->whereKey($driver->id)->lockForUpdate()->first();
            $vehicle = Vehicle::query()->whereKey($vehicle->id)->lockForUpdate()->first();

            if (!$driver || !$vehicle) {
                return;
            }

            if (!$driver->is_active) {
                $driver->forceFill([
                    'is_active' => true,
                ])->save();
            }

            if (!$driver->vehicles()->whereKey($vehicle->id)->exists()) {
                $driverVehicleService->assignVehicle($driver, $vehicle);
            }
        });
    }

    private function findDriverByIntegrationId(
        MerchantIntegration $merchantIntegration,
        string $driverIntegrationId
    ): ?Driver {
        return Driver::query()
            ->where(function ($builder) use ($merchantIntegration) {
                $builder->where('merchant_id', $merchantIntegration->merchant_id)
                    ->orWhere(function ($legacyBuilder) use ($merchantIntegration) {
                        $legacyBuilder->whereNull('merchant_id')
                            ->where('account_id', $merchantIntegration->account_id);
                    });
            })
            ->where('intergration_id', $driverIntegrationId)
            ->first();
    }

    private function importMissingDriver(
        MerchantIntegration $merchantIntegration,
        TrackingProvider $provider,
        object $providerService,
        string $driverIntegrationId,
        DriverService $driverService,
        ActivityLogService $activityLogService
    ): ?Driver {
        $merchant = $merchantIntegration->merchant;
        if (!$merchant) {
            return null;
        }

        $integrationData = $this->buildProviderIntegrationData($merchantIntegration);
        $integrationOptions = $merchantIntegration->integration_options_data ?? [];
        $payload = null;
        $fetchMethod = null;

        try {
            if (method_exists($providerService, 'import_driver_by_integration_id')) {
                $fetchMethod = 'single';
                $payload = $providerService->import_driver_by_integration_id(
                    $integrationData,
                    $driverIntegrationId,
                    $integrationOptions
                );
            } elseif (method_exists($providerService, 'import_drivers')) {
                $fetchMethod = 'bulk_fallback';
                $drivers = $providerService->import_drivers($integrationData, $integrationOptions);
                if (is_array($drivers)) {
                    foreach ($drivers as $candidate) {
                        if (!is_array($candidate)) {
                            continue;
                        }

                        if (($candidate['integration_id'] ?? null) === $driverIntegrationId) {
                            $payload = $candidate;
                            break;
                        }
                    }
                }
            }
        } catch (\Throwable $exception) {
            Log::warning($driverIntegrationId.': Tracking sync failed to import missing driver from provider.', [
                'merchant_integration_id' => $merchantIntegration->id,
                'merchant_id' => $merchantIntegration->merchant_id,
                'provider_id' => $provider->id,
                'provider_name' => $provider->name,
                'driver_integration_id' => $driverIntegrationId,
                'fetch_method' => $fetchMethod,
                'exception_message' => $exception->getMessage()
            ]);

            $activityLogService->log(
                action: 'tracking_driver_import_failed',
                entityType: 'merchant_integration',
                entity: $merchantIntegration,
                accountId: $merchantIntegration->account_id,
                merchantId: $merchantIntegration->merchant_id,
                title: 'Tracking sync failed to import missing driver from provider',
                metadata: [
                    'provider_id' => $provider->uuid,
                    'provider_name' => $provider->name,
                    'driver_integration_id' => $driverIntegrationId,
                    'fetch_method' => $fetchMethod,
                    'exception_message' => $exception->getMessage(),
                ]
            );

            return null;
        }

        if (!is_array($payload)) {
            Log::info('Tracking sync did not find provider driver details for missing driver.', [
                'merchant_integration_id' => $merchantIntegration->id,
                'merchant_id' => $merchantIntegration->merchant_id,
                'provider_id' => $provider->id,
                'provider_name' => $provider->name,
                'driver_integration_id' => $driverIntegrationId,
                'fetch_method' => $fetchMethod,
                'payload' => $payload,
            ]);

            return null;
        }

        $result = $driverService->upsertProviderImportedDrivers(
            merchant: $merchant,
            integration: $merchantIntegration,
            providerSlug: Str::slug($provider->name),
            payload: [$payload],
        );

        $driver = $this->findDriverByIntegrationId($merchantIntegration, $driverIntegrationId);
        if (!$driver) {
            return null;
        }

        Log::info('Tracking sync auto-created missing driver from provider.', [
            'merchant_integration_id' => $merchantIntegration->id,
            'merchant_id' => $merchantIntegration->merchant_id,
            'provider_id' => $provider->id,
            'provider_name' => $provider->name,
            'driver_id' => $driver->id,
            'driver_integration_id' => $driverIntegrationId,
            'fetch_method' => $fetchMethod,
            'created_count' => (int) ($result['created_count'] ?? 0),
            'updated_count' => (int) ($result['updated_count'] ?? 0),
        ]);

        $activityLogService->log(
            action: 'tracking_driver_imported',
            entityType: 'merchant_integration',
            entity: $merchantIntegration,
            accountId: $merchantIntegration->account_id,
            merchantId: $merchantIntegration->merchant_id,
            title: 'Tracking sync imported missing driver from provider',
            metadata: [
                'provider_id' => $provider->uuid,
                'provider_name' => $provider->name,
                'driver_id' => $driver->uuid,
                'driver_integration_id' => $driverIntegrationId,
                'fetch_method' => $fetchMethod,
                'created_count' => (int) ($result['created_count'] ?? 0),
                'updated_count' => (int) ($result['updated_count'] ?? 0),
            ]
        );

        return $driver;
    }

    private function buildProviderIntegrationData(MerchantIntegration $integration): array
    {
        $payload = $integration->integration_data ?? [];
        if (!is_array($payload)) {
            $payload = [];
        }

        $payload['account_id'] = $integration->account_id;
        $payload['merchant_id'] = $integration->merchant_id;
        $payload['merchant_uuid'] = $integration->merchant?->uuid;

        return $payload;
    }

    private function extractLatitude(array $position): ?float
    {
        $value = $position['latitude']
            ?? $position['lat']
            ?? Arr::get($position, 'position.latitude')
            ?? Arr::get($position, 'position.lat');

        return is_numeric($value) ? (float) $value : null;
    }

    private function extractLongitude(array $position): ?float
    {
        $value = $position['longitude']
            ?? $position['lng']
            ?? $position['lon']
            ?? Arr::get($position, 'position.longitude')
            ?? Arr::get($position, 'position.lng')
            ?? Arr::get($position, 'position.lon');

        return is_numeric($value) ? (float) $value : null;
    }

    private function mergeMetadata(?array $existing, array $updates): array
    {
        return array_merge($existing ?? [], $updates);
    }
}
