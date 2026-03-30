<?php

namespace App\Services;

use App\Jobs\TrackVehicleLocationsJob;
use App\Models\MerchantIntegration;
use App\Models\Vehicle;
use Illuminate\Support\Facades\Log;

class VehicleLocationSyncService
{
    private const VEHICLE_CHUNK_SIZE = 500;

    public function sync(): array
    {
        $summary = [
            'integrations_scanned' => 0,
            'integrations_dispatched' => 0,
            'jobs_dispatched' => 0,
            'vehicles_queued' => 0,
            'skipped_missing_provider' => 0,
            'skipped_unmapped_provider' => 0,
            'skipped_missing_merchant' => 0,
        ];

        $integrations = MerchantIntegration::query()
            ->with('provider')
            ->whereHas('provider', function ($query) {
                $query->where('status', 'active');
            })
            ->whereNotNull('merchant_id')
            ->get();

        $summary['integrations_scanned'] = $integrations->count();

        Log::info('Vehicle location sync started.', [
            'integrations_scanned' => $summary['integrations_scanned'],
        ]);

        foreach ($integrations as $integration) {
            if (!$integration->merchant_id) {
                $summary['skipped_missing_merchant']++;
                continue;
            }

            $provider = $integration->provider;
            if (!$provider) {
                $summary['skipped_missing_provider']++;
                continue;
            }

            $serviceKey = str($provider->name)->slug()->value();
            if (!config("tracking_providers.services.{$serviceKey}")) {
                $summary['skipped_unmapped_provider']++;
                Log::warning('Vehicle location sync skipped unmapped provider.', [
                    'merchant_integration_id' => $integration->id,
                    'merchant_id' => $integration->merchant_id,
                    'provider_id' => $provider->id,
                    'provider_name' => $provider->name,
                    'service_key' => $serviceKey,
                ]);
                continue;
            }

            $integrationJobs = 0;
            $integrationVehicles = 0;

            $vehiclesQuery = Vehicle::query()
                ->where('account_id', $integration->account_id)
                ->where('merchant_id', $integration->merchant_id)
                ->where('is_active', true)
                ->whereNotNull('intergration_id')
                ->where('intergration_id', '!=', '')
                ->orderBy('id');

            $vehiclesQuery->chunkById(self::VEHICLE_CHUNK_SIZE, function ($vehicles) use ($provider, $integration, &$summary, &$integrationJobs, &$integrationVehicles) {
                $vehicleIds = $vehicles->pluck('id')->all();
                if (empty($vehicleIds)) {
                    return;
                }

                if ($provider->supports_bulk_vehicle_requests) {
                    TrackVehicleLocationsJob::dispatch($integration->id, $vehicleIds);
                    $summary['jobs_dispatched']++;
                    $summary['vehicles_queued'] += count($vehicleIds);
                    $integrationJobs++;
                    $integrationVehicles += count($vehicleIds);

                    return;
                }

                foreach ($vehicleIds as $vehicleId) {
                    TrackVehicleLocationsJob::dispatch($integration->id, [$vehicleId]);
                    $summary['jobs_dispatched']++;
                    $summary['vehicles_queued']++;
                    $integrationJobs++;
                    $integrationVehicles++;
                }
            });

            if ($integrationJobs > 0) {
                $summary['integrations_dispatched']++;
            }

            Log::info('Vehicle location sync integration processed.', [
                'merchant_integration_id' => $integration->id,
                'merchant_id' => $integration->merchant_id,
                'provider_id' => $provider->id,
                'provider_name' => $provider->name,
                'supports_bulk_vehicle_requests' => (bool) $provider->supports_bulk_vehicle_requests,
                'jobs_dispatched' => $integrationJobs,
                'vehicles_queued' => $integrationVehicles,
            ]);
        }

        Log::info('Vehicle location sync completed.', $summary);

        return $summary;
    }
}
