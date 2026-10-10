<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Run;
use App\Models\RunShipment;
use App\Services\RunDirectionsService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class DriverRunDirectionsController extends Controller
{
    public function __invoke(Request $request, string $run_uuid, RunDirectionsService $directions)
    {
        $driver = $request->user()->driver;
        if (!$driver) return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], 403);
        $run = $driver->runs()->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)
            ->where('uuid', $run_uuid)->whereIn('status', [Run::STATUS_IN_PROGRESS, Run::STATUS_DISPATCHED, Run::STATUS_DRAFT])->firstOrFail();
        $shipments = $run->runShipments()->where('status', '!=', RunShipment::STATUS_REMOVED)
            ->whereHas('shipment', fn ($query) => $query->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id))
            ->with(['shipment.dropoffLocation' => fn ($query) => $query->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)])->orderBy('sequence')->orderBy('id')->get()->pluck('shipment')->unique('id');
        if ($request->boolean('next_delivery')) {
            $next = $shipments->first(fn ($shipment) => !in_array($shipment->status, ['delivered', 'failed', 'cancelled', 'returned']));
            if (!$next) return ApiResponse::success(['status' => 'not_needed', 'shipment_id' => null]);
            $vehicle = $run->vehicle()->where('account_id', $driver->account_id)
                ->where(fn ($query) => $query->whereNull('merchant_id')->orWhere('merchant_id', $driver->merchant_id))
                ->where(fn ($query) => $query->whereNull('last_driver_id')->orWhere('last_driver_id', $driver->id))->first();
            $at = $vehicle?->location_updated_at;
            $location = $vehicle?->last_location_address ?? [];
            $origin = $run->status === Run::STATUS_IN_PROGRESS && $vehicle ? (object) ['latitude' => $location['latitude'] ?? null, 'longitude' => $location['longitude'] ?? null] : null;
            return ApiResponse::success(array_merge($directions->route([$origin, $next->dropoffLocation]), [
                'shipment_id' => $next->uuid, 'calculated_at' => now()->toIso8601String(),
                'origin_reported_at' => $at?->toIso8601String(),
            ]));
        }
        $locations = collect();
        if ($run->origin_location_id) $locations->push($run->originLocation);
        foreach ($shipments as $shipment) $locations->push($shipment->dropoffLocation);
        if ($run->destination_location_id) $locations->push($run->destinationLocation);
        return ApiResponse::success($directions->route($locations));
    }
}
