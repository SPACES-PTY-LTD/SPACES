<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsMerchantTimestamps;
use App\Models\RunShipment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RunResource extends JsonResource
{
    use FormatsMerchantTimestamps;

    public function toArray(Request $request): array
    {
        $activeRunShipments = $this->runShipments->where('status', '!=', RunShipment::STATUS_REMOVED);
        $terminalCount = $activeRunShipments->whereIn('status', [RunShipment::STATUS_DONE, RunShipment::STATUS_FAILED])->count();
        $vehicle = $this->vehicle;
        $latestLocationStop = $this->relationLoaded('latestLocationStop') ? $this->latestLocationStop : null;

        return [
            'run_id' => $this->uuid,
            'merchant_id' => optional($this->merchant)->uuid,
            'environment_id' => optional($this->environment)->uuid,
            'status' => $this->status,
            'auto_created' => (bool) $this->auto_created,
            'origin' => $this->origin ? LocationResource::make($this->originLocation) : null,
            'destination' => $this->destination ? LocationResource::make($this->destinationLocation) : null,
            'planned_start_at' => $this->formatDateForMerchantTimezone($this->planned_start_at, $request),
            'started_at' => $this->formatDateForMerchantTimezone($this->started_at, $request),
            'origin_departure_time' => $this->formatDateForMerchantTimezone($this->origin_departure_time, $request),
            'completed_at' => $this->formatDateForMerchantTimezone($this->completed_at, $request),
            'service_area' => $this->service_area,
            'notes' => $this->notes,
            'driver' => [
                'driver_id' => optional($this->driver)->uuid,
                'name' => optional(optional($this->driver)->user)->name,
            ],
            'vehicle' => [
                'vehicle_id' => optional($vehicle)->uuid,
                'plate_number' => optional($vehicle)->plate_number,
            ],
            'last_location' => $latestLocationStop?->location
                ? LocationResource::make($latestLocationStop->location)
                : null,
            'route' => $this->route ? [
                'route_id' => $this->route->uuid,
                'title' => $this->route->title,
                'code' => $this->route->code,
                'stops' => $this->route->routeStops->map(function ($stop) {
                    return [
                        'stop_id' => $stop->uuid,
                        'sequence' => $stop->sequence,
                        'location_id' => optional($stop->location)->uuid,
                        'location' => $stop->location ? [
                            'location_id' => $stop->location->uuid,
                            'name' => $stop->location->name,
                            'company' => $stop->location->company,
                            'code' => $stop->location->code,
                            'type' => optional($stop->location->locationType)->title,
                            'full_address' => $stop->location->full_address,
                            'latitude' => $stop->location->latitude !== null ? (float) $stop->location->latitude : null,
                            'longitude' => $stop->location->longitude !== null ? (float) $stop->location->longitude : null,
                            'city' => $stop->location->city,
                            'province' => $stop->location->province,
                            'country' => $stop->location->country,
                        ] : null,
                    ];
                })->values()->all(),
            ] : null,
            'shipment_count' => $activeRunShipments->count(),
            'terminal_count' => $terminalCount,
            'stops' => VehicleActivityResource::collection($this->whenLoaded('vehicleActivities')),
            'shipments' => $activeRunShipments
                ->sortBy(function ($runShipment) {
                    return $runShipment->sequence ?? PHP_INT_MAX;
                })
                ->values()
                ->map(function ($runShipment) {
                    return [
                        'shipment_id' => optional($runShipment->shipment)->uuid,
                        'merchant_order_ref' => optional($runShipment->shipment)->merchant_order_ref,
                        'shipment_status' => optional($runShipment->shipment)->status,
                        'run_status' => $runShipment->status,
                        'sequence' => $runShipment->sequence,
                        'pickup_stop_order' => $runShipment->pickup_stop_order,
                        'dropoff_stop_order' => $runShipment->dropoff_stop_order,
                        'total_parcel_count' => $runShipment->shipment?->relationLoaded('parcels')
                            ? $runShipment->shipment->parcels->count()
                            : null,
                    ];
                })->all(),
            'created_at' => $this->formatDateForMerchantTimezone($this->created_at, $request),
            'updated_at' => $this->formatDateForMerchantTimezone($this->updated_at, $request),
        ];
    }
}
