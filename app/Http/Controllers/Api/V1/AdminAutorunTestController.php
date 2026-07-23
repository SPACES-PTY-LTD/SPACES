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

            [$latitude, $longitude] = $this->representativePoint($location);
            $processedAt = now();
            $insideGeofence = $service->processVehiclePosition(
                vehicle: $vehicle,
                merchant: $merchant,
                latitude: $latitude,
                longitude: $longitude,
                eventAt: $processedAt,
                providerPosition: [
                    'source' => 'admin_autorun_test',
                    'requested_location_id' => $location->uuid,
                    'triggered_by_user_id' => $request->user()?->uuid,
                ],
            );

            $resolvedVisit = VehicleActivity::query()
                ->where('merchant_id', $merchant->id)
                ->where('vehicle_id', $vehicle->id)
                ->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
                ->whereNull('exited_at')
                ->with('location')
                ->latest('entered_at')
                ->first();

            return ApiResponse::success([
                'status' => 'processed',
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
        if ($location->latitude !== null && $location->longitude !== null) {
            return [(float) $location->latitude, (float) $location->longitude];
        }

        $wkt = $location->polygon_wkt ?? null;
        $start = is_string($wkt) ? strpos($wkt, '((') : false;
        $end = is_string($wkt) ? strrpos($wkt, '))') : false;
        $points = [];

        if ($start !== false && $end !== false && $end > $start) {
            foreach (explode(',', substr($wkt, $start + 2, $end - $start - 2)) as $pair) {
                $parts = preg_split('/\s+/', trim($pair));
                if (count($parts) === 2 && is_numeric($parts[0]) && is_numeric($parts[1])) {
                    $points[] = [(float) $parts[1], (float) $parts[0]];
                }
            }
        }

        if (count($points) < 3) {
            throw ValidationException::withMessages([
                'location_id' => 'The selected location does not have usable coordinates or polygon geometry.',
            ]);
        }

        if ($points[0] === $points[count($points) - 1]) {
            array_pop($points);
        }

        return [
            array_sum(array_column($points, 0)) / count($points),
            array_sum(array_column($points, 1)) / count($points),
        ];
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
