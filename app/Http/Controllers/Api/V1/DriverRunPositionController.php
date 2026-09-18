<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Run;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class DriverRunPositionController extends Controller
{
    public function __invoke(Request $request, string $run_uuid)
    {
        $driver = $request->user()->driver;
        if (!$driver) return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], 403);
        $run = $driver->runs()->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)
            ->where('uuid', $run_uuid)->whereIn('status', [Run::STATUS_IN_PROGRESS, Run::STATUS_DISPATCHED, Run::STATUS_DRAFT])->firstOrFail();
        $vehicle = $run->vehicle()->where('account_id', $driver->account_id)
            ->where(fn ($query) => $query->whereNull('merchant_id')->orWhere('merchant_id', $driver->merchant_id))->first();
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
