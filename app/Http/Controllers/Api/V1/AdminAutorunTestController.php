<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\RunAutorunLifecycleTestRequest;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use App\Services\AutoRunLifecycleService;
use App\Support\ApiResponse;
use App\Support\GeofencePolygon;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

class AdminAutorunTestController extends Controller
{
    public function store(RunAutorunLifecycleTestRequest $request, AutoRunLifecycleService $service)
    {
        try {
            $data = $request->validated();
            $merchant = Merchant::query()->where('uuid', $data['merchant_id'])->firstOrFail();

            if ($request->user()?->role !== 'super_admin'
                && (int) $request->user()?->account_id !== (int) $merchant->account_id) {
                throw new \Illuminate\Auth\Access\AuthorizationException;
            }

            $vehicle = Vehicle::query()
                ->where('uuid', $data['vehicle_id'])
                ->where('merchant_id', $merchant->id)
                ->first();
            $location = $this->locationQuery()
                ->where('locations.uuid', $data['location_id'])
                ->where('locations.merchant_id', $merchant->id)
                ->first();

            if (! $vehicle || ! $location) {
                throw ValidationException::withMessages([
                    'selection' => 'The truck and location must belong to the selected merchant.',
                ]);
            }

            $processedAt = now();
            $providerPosition = [
                'source' => 'admin_autorun_test',
                'action' => $data['action'],
                'requested_location_id' => $location->uuid,
                'triggered_by_user_id' => $request->user()?->uuid,
            ];
            $latitude = null;
            $longitude = null;

            if ($data['action'] === 'exit') {
                $processed = $service->processVehicleLocationExit(
                    vehicle: $vehicle,
                    merchant: $merchant,
                    location: $location,
                    eventAt: $processedAt,
                    providerPosition: $providerPosition,
                );

                if (! $processed) {
                    throw ValidationException::withMessages([
                        'action' => 'The selected truck does not have an active visit at this location.',
                    ]);
                }

                $insideGeofence = false;
            } else {
                [$latitude, $longitude] = $this->representativePoint($location);
                $insideGeofence = $service->processVehiclePosition(
                    vehicle: $vehicle,
                    merchant: $merchant,
                    latitude: $latitude,
                    longitude: $longitude,
                    eventAt: $processedAt,
                    providerPosition: $providerPosition,
                );
            }

            $resolvedVisit = VehicleActivity::query()
                ->where('merchant_id', $merchant->id)
                ->where('vehicle_id', $vehicle->id)
                ->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
                ->whereNull('exited_at')
                ->with('location')
                ->orderByRaw('CASE WHEN location_id = ? THEN 0 ELSE 1 END', [$location->id])
                ->latest('entered_at')
                ->orderByDesc('id')
                ->first();

            return ApiResponse::success([
                'status' => 'processed',
                'action' => $data['action'],
                'processed_at' => Carbon::instance($processedAt)->toIso8601String(),
                'inside_geofence' => $insideGeofence,
                'simulated_coordinates' => [
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                ],
                'requested_location' => $this->locationSummary($location),
                'resolved_location' => $resolvedVisit?->location
                    ? $this->locationSummary($resolvedVisit->location)
                    : null,
                'location_mismatch' => $resolvedVisit?->location_id !== null
                    && (int) $resolvedVisit->location_id !== (int) $location->id,
            ]);
        } catch (Throwable $e) {
            Log::error('Admin autorun lifecycle test failed.', [
                'request_id' => ApiResponse::requestId(),
                'merchant_id' => $request->input('merchant_id'),
                'vehicle_id' => $request->input('vehicle_id'),
                'location_id' => $request->input('location_id'),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'AUTORUN_TEST_FAILED', 'Unable to process the autorun lifecycle test.');
        }
    }

    private function locationQuery()
    {
        $query = Location::query()->select('locations.*');

        if (in_array(DB::connection()->getDriverName(), ['mysql', 'pgsql'], true)) {
            $query->selectRaw('ST_AsText(polygon_bounds) as polygon_wkt');
        } else {
            $query->addSelect('polygon_bounds as polygon_wkt');
        }

        return $query;
    }

    private function representativePoint(Location $location): array
    {
        $polygon = GeofencePolygon::fromWkt($location->polygon_wkt ?? null);
        if (! $polygon) {
            throw ValidationException::withMessages([
                'location_id' => 'The selected location must have a valid drawn geofence.',
            ]);
        }
        if ($location->latitude !== null && $location->longitude !== null
            && $polygon->contains((float) $location->latitude, (float) $location->longitude)) {
            return [(float) $location->latitude, (float) $location->longitude];
        }

        return $polygon->interiorPoint();
    }

    private function locationSummary(Location $location): array
    {
        return [
            'location_id' => $location->uuid,
            'name' => $location->name,
            'code' => $location->code,
        ];
    }
}
