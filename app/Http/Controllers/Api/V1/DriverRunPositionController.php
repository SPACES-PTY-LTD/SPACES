<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Run;
use App\Models\Vehicle;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

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

        return $this->positionResponse($vehicle);
    }

    public function __invoke(Request $request, string $run_uuid)
    {
        $driver = $request->user()->driver;
        if (!$driver) return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], 403);
        $run = $driver->runs()->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)
            ->where('uuid', $run_uuid)->whereIn('status', [Run::STATUS_IN_PROGRESS, Run::STATUS_DISPATCHED, Run::STATUS_DRAFT])->firstOrFail();
        $vehicle = $run->vehicle()->where('account_id', $driver->account_id)
            ->where(fn ($query) => $query->whereNull('merchant_id')->orWhere('merchant_id', $driver->merchant_id))->first();

        return $this->positionResponse($vehicle);
    }

    private function positionResponse(?Vehicle $vehicle)
    {
        $location = $vehicle?->last_location_address;
        $latitude = $location['latitude'] ?? null;
        $longitude = $location['longitude'] ?? null;
        $valid = is_numeric($latitude) && is_numeric($longitude) && abs((float) $latitude) <= 90 && abs((float) $longitude) <= 180;
        return ApiResponse::success([
            'vehicle_id' => $vehicle?->uuid,
            'plate_number' => $vehicle?->plate_number,
            'coordinate' => $valid ? ['latitude' => (float) $latitude, 'longitude' => (float) $longitude] : null,
            'updated_at' => $vehicle?->location_updated_at?->toIso8601String(),
        ]);
    }
}
