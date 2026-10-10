<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\Run;
use App\Models\Vehicle;
use App\Support\ApiResponse;
use App\Support\GeofencePolygon;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Carbon\Carbon;

class DriverRunPositionController extends Controller
{
    public function current(Request $request)
    {
        $driver = $request->user()->driver;
        if (!$driver || !$driver->is_active || $driver->account_id !== $request->user()->account_id) {
            return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], 403);
        }
        // Use the driver's currently logged-in truck, then an unclaimed assigned truck.
        // Never reuse a closed run's truck or a truck now logged in by another driver.
        $vehicle = Vehicle::query()->where('account_id', $driver->account_id)->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('merchant_id')->orWhere('merchant_id', $driver->merchant_id))
            ->where(fn ($query) => $query->where('last_driver_id', $driver->id)
                ->orWhere(fn ($assigned) => $assigned->whereNull('last_driver_id')
                    ->whereHas('drivers', fn ($drivers) => $drivers->where('drivers.id', $driver->id))))
            ->orderByDesc('driver_logged_at')->orderByDesc('id')->first();

        return $this->positionResponse($vehicle, $driver->merchant_id);
    }

    public function __invoke(Request $request, string $run_uuid)
    {
        $driver = $request->user()->driver;
        if (!$driver) return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], 403);
        $run = $driver->runs()->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)
            ->where('uuid', $run_uuid)->whereIn('status', [Run::STATUS_IN_PROGRESS, Run::STATUS_DISPATCHED, Run::STATUS_DRAFT])->firstOrFail();
        $vehicle = $run->vehicle()->where('account_id', $driver->account_id)
            ->where(fn ($query) => $query->whereNull('merchant_id')->orWhere('merchant_id', $driver->merchant_id))->first();

        return $this->positionResponse($vehicle, $driver->merchant_id);
    }

    private function positionResponse(?Vehicle $vehicle, ?int $merchantId)
    {
        $location = $vehicle?->last_location_address ?? [];
        $latitude = $location['latitude'] ?? null;
        $longitude = $location['longitude'] ?? null;
        $valid = is_numeric($latitude) && is_numeric($longitude) && is_finite((float) $latitude) && is_finite((float) $longitude) && abs((float) $latitude) <= 90 && abs((float) $longitude) <= 180;
        $geofence = $valid && $vehicle ? $this->geofence($vehicle, $merchantId, (float) $latitude, (float) $longitude) : null;
        $speed = $valid ? $this->reportedSpeed($vehicle) : null;
        return ApiResponse::success([
            'vehicle_id' => $vehicle?->uuid,
            'plate_number' => $vehicle?->plate_number,
            'coordinate' => $valid ? ['latitude' => (float) $latitude, 'longitude' => (float) $longitude] : null,
            'updated_at' => $vehicle?->location_updated_at?->toIso8601String(),
            'speed_kph' => $speed,
            'motion_status' => $speed === null ? null : ($speed <= config('vehicle_history.stationary_speed_kph', 3) ? 'stationary' : 'moving'),
            'address' => $this->address($location),
            'geofence_location' => $geofence ? [
                'location_id' => $geofence->uuid,
                'name' => trim($geofence->name ?? '') ?: trim($geofence->company ?? '') ?: trim($geofence->code ?? '') ?: 'Unnamed geofence',
                'address' => $this->address($geofence->toAddressArray()),
            ] : null,
        ]);
    }

    /** Only use speed from the same tracker observation as the displayed position. */
    private function reportedSpeed(?Vehicle $vehicle): ?float
    {
        $position = $vehicle?->metadata['tracking_position'] ?? null;
        if (! is_array($position) || ! $vehicle?->location_updated_at) return null;
        $at = $position['timestamp'] ?? $position['recorded_at'] ?? $position['recordedAt'] ?? Arr::get($position, 'position.timestamp');
        if (! is_string($at) || trim($at) === '') return null;
        try {
            if (! Carbon::parse($at)->equalTo($vehicle->location_updated_at)) return null;
        } catch (\Throwable) {
            return null;
        }
        $latitude = $position['latitude'] ?? $position['lat'] ?? Arr::get($position, 'position.latitude') ?? Arr::get($position, 'position.lat');
        $longitude = $position['longitude'] ?? $position['lng'] ?? $position['lon'] ?? Arr::get($position, 'position.longitude') ?? Arr::get($position, 'position.lng') ?? Arr::get($position, 'position.lon');
        if (! is_numeric($latitude) || ! is_numeric($longitude)
            || (float) $latitude !== (float) ($vehicle->last_location_address['latitude'] ?? null)
            || (float) $longitude !== (float) ($vehicle->last_location_address['longitude'] ?? null)) return null;
        $speed = $position['speed_kilometres_per_hour'] ?? $position['speed'] ?? $position['SpeedKilometresPerHour']
            ?? Arr::get($position, 'position.speed_kilometres_per_hour') ?? Arr::get($position, 'position.speed');
        return is_numeric($speed) && is_finite((float) $speed) && (float) $speed >= 0 ? (float) $speed : null;
    }

    private function address(array $location): ?string
    {
        foreach (['full_address', 'formatted_address', 'address'] as $key) {
            if (is_string($location[$key] ?? null) && trim($location[$key]) !== '') {
                return trim($location[$key]);
            }
        }
        $parts = [];
        foreach (['address_line_1', 'address_line_2', 'town', 'suburb', 'city', 'province', 'state', 'post_code', 'postal_code', 'country'] as $key) {
            if (is_string($location[$key] ?? null) && trim($location[$key]) !== '') {
                $parts[] = trim($location[$key]);
            }
        }

        return $parts ? implode(', ', array_unique($parts)) : null;
    }

    private function geofence(Vehicle $vehicle, ?int $merchantId, float $latitude, float $longitude): ?Location
    {
        if (! $merchantId) return null;
        $query = Location::query()->where('account_id', $vehicle->account_id)
            ->where('merchant_id', $merchantId)->whereNotNull('polygon_bounds')->orderBy('id');
        $database = $query->getConnection()->getDriverName();
        $query->select('locations.*')->selectRaw($database === 'sqlite'
            ? 'polygon_bounds as polygon_wkt' : 'ST_AsText(polygon_bounds) as polygon_wkt');
        // Stable ordering for overlapping polygons; never substitute radius or visit history.
        foreach ($query->cursor() as $location) {
            $polygon = GeofencePolygon::fromWkt($location->polygon_wkt);
            if ($polygon && $polygon->contains($latitude, $longitude)) return $location;
        }

        return null;
    }
}
