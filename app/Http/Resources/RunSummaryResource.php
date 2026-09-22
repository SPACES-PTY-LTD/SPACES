<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsMerchantTimestamps;
use App\Models\Location;
use App\Models\RunShipment;
use App\Support\CostMoney;
use App\Support\RunDistance;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RunSummaryResource extends JsonResource
{
    use FormatsMerchantTimestamps;

    public function toArray(Request $request): array
    {
        $shipments = $this->runShipments->where('status', '!=', RunShipment::STATUS_REMOVED)
            ->sortBy(fn ($assignment) => $assignment->sequence ?? PHP_INT_MAX)->values();
        $odometerDistance = $this->odometer_start_km !== null && $this->odometer_end_km !== null
            ? max(0, $this->odometer_end_km - $this->odometer_start_km) : null;
        $points = $this->vehicleActivities->map(fn ($activity) => [
            'latitude' => (float) $activity->latitude,
            'longitude' => (float) $activity->longitude,
        ])->all();
        $distance = $odometerDistance ?? (count($points) > 1 ? RunDistance::gpsDistanceKm($points) : null);

        return [
            'run_id' => $this->uuid,
            'status' => $this->status,
            'planned_start_at' => $this->formatDateForMerchantTimezone($this->planned_start_at, $request),
            'started_at' => $this->formatDateForMerchantTimezone($this->started_at, $request),
            'created_at' => $this->formatDateForMerchantTimezone($this->created_at, $request),
            'duration_seconds' => $this->started_at && $this->completed_at
                ? max(0, $this->completed_at->diffInSeconds($this->started_at, true)) : null,
            'odometer_distance_km' => $odometerDistance,
            'distance_km' => $distance !== null ? round($distance, 2) : null,
            'distance_source' => $odometerDistance !== null ? 'odometer' : ($distance !== null ? 'gps' : null),
            'additional_cost_totals' => CostMoney::totals($this->additionalCosts),
            'shipment_count' => $shipments->count(),
            'origin' => $this->locationSummary($this->originLocation ?? $shipments->first()?->shipment?->pickupLocation),
            'destination' => $this->locationSummary($this->destinationLocation ?? $shipments->last()?->shipment?->dropoffLocation),
            'driver' => ['name' => $this->driver?->user?->name],
            'vehicle' => ['plate_number' => $this->vehicle?->plate_number, 'ref_code' => $this->vehicle?->ref_code],
        ];
    }

    private function locationSummary(?Location $location): ?array
    {
        if (! $location) {
            return null;
        }

        return [
            'name' => $location->name,
            'company' => $location->company,
            'full_address' => $location->full_address ?: implode(', ', array_filter([
                $location->address_line_1, $location->address_line_2, $location->town,
                $location->city, $location->province, $location->post_code, $location->country,
            ])),
        ];
    }
}
