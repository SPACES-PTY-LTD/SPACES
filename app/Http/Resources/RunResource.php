<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsMerchantTimestamps;
use App\Models\RunShipment;
use App\Models\VehicleActivity;
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
        $odometerDistance = $this->odometer_start_km !== null && $this->odometer_end_km !== null
            ? max(0, $this->odometer_end_km - $this->odometer_start_km)
            : null;
        $durationSeconds = $this->started_at && $this->completed_at
            ? max(0, $this->completed_at->diffInSeconds($this->started_at, true))
            : null;
        $activities = $this->relationLoaded('vehicleActivities') ? $this->vehicleActivities : collect();
        $trackPoints = $activities
            ->filter(fn (VehicleActivity $activity) => $activity->latitude !== null && $activity->longitude !== null)
            ->map(fn (VehicleActivity $activity) => [
                'activity_id' => $activity->uuid,
                'event_type' => $activity->event_type,
                'occurred_at' => optional($activity->occurred_at)?->toIso8601String(),
                'latitude' => (float) $activity->latitude,
                'longitude' => (float) $activity->longitude,
                'speed_kph' => $activity->speed_kph !== null ? (float) $activity->speed_kph : null,
                'speed_limit_kph' => $activity->speed_limit_kph !== null ? (float) $activity->speed_limit_kph : null,
            ])->values();
        $gpsDistance = $this->gpsDistanceKm($trackPoints->all());
        $distanceKm = $odometerDistance ?? ($trackPoints->count() > 1 ? $gpsDistance : null);
        $distanceSource = $odometerDistance !== null ? 'odometer' : ($distanceKm !== null ? 'gps' : null);
        $speedReadings = $activities->pluck('speed_kph')->filter(fn ($speed) => $speed !== null)->map(fn ($speed) => (float) $speed);
        $movingSpeedReadings = $speedReadings->filter(fn (float $speed) => $speed > 0);
        $speedingEvents = $activities->filter(fn (VehicleActivity $activity) => $activity->event_type === VehicleActivity::EVENT_SPEEDING);
        $worstExceedance = $speedingEvents
            ->filter(fn (VehicleActivity $activity) => $activity->speed_kph !== null && $activity->speed_limit_kph !== null)
            ->map(fn (VehicleActivity $activity) => max(0, (float) $activity->speed_kph - (float) $activity->speed_limit_kph))
            ->max();
        $actualStops = $activities->filter(fn (VehicleActivity $activity) => in_array($activity->event_type, [
            VehicleActivity::EVENT_STOPPED,
            VehicleActivity::EVENT_ENTERED_LOCATION,
            VehicleActivity::EVENT_SHIPMENT_COLLECTION,
            VehicleActivity::EVENT_SHIPMENT_DELIVERY,
        ], true));
        $completedShipments = $activeRunShipments->where('status', RunShipment::STATUS_DONE)->count();
        $failedShipments = $activeRunShipments->where('status', RunShipment::STATUS_FAILED)->count();
        $shipmentCount = $activeRunShipments->count();
        $isDetailResponse = $request->route('run_uuid') !== null;
        $orderedRunShipments = $activeRunShipments->sortBy(fn ($runShipment) => $runShipment->sequence ?? PHP_INT_MAX)->values();
        $displayOrigin = $this->originLocation ?? $orderedRunShipments->first()?->shipment?->pickupLocation;
        $displayDestination = $this->destinationLocation ?? $orderedRunShipments->last()?->shipment?->dropoffLocation;

        return [
            'run_id' => $this->uuid,
            'merchant_id' => optional($this->merchant)->uuid,
            'environment_id' => optional($this->environment)->uuid,
            'status' => $this->status,
            'auto_created' => (bool) $this->auto_created,
            'origin' => $displayOrigin ? LocationResource::make($displayOrigin) : null,
            'destination' => $displayDestination ? LocationResource::make($displayDestination) : null,
            'planned_start_at' => $this->formatDateForMerchantTimezone($this->planned_start_at, $request),
            'started_at' => $this->formatDateForMerchantTimezone($this->started_at, $request),
            'origin_departure_time' => $this->formatDateForMerchantTimezone($this->origin_departure_time, $request),
            'completed_at' => $this->formatDateForMerchantTimezone($this->completed_at, $request),
            'duration_seconds' => $durationSeconds,
            'odometer_start_km' => $this->odometer_start_km,
            'odometer_end_km' => $this->odometer_end_km,
            'odometer_distance_km' => $odometerDistance,
            'distance_km' => $distanceKm !== null ? round($distanceKm, 2) : null,
            'distance_source' => $distanceSource,
            'service_area' => $this->service_area,
            'notes' => $this->notes,
            'driver' => [
                'driver_id' => optional($this->driver)->uuid,
                'name' => optional(optional($this->driver)->user)->name,
                'email' => optional(optional($this->driver)->user)->email,
                'telephone' => optional(optional($this->driver)->user)->telephone,
                'is_active' => $this->driver ? (bool) $this->driver->is_active : null,
                'intergration_id' => optional($this->driver)->intergration_id,
            ],
            'vehicle' => [
                'vehicle_id' => optional($vehicle)->uuid,
                'plate_number' => optional($vehicle)->plate_number,
                'ref_code' => optional($vehicle)->ref_code,
                'make' => optional($vehicle)->make,
                'model' => optional($vehicle)->model,
                'year' => optional($vehicle)->year,
                'color' => optional($vehicle)->color,
                'odometer' => optional($vehicle)->odometer,
                'is_active' => $vehicle ? (bool) $vehicle->is_active : null,
                'type' => $vehicle?->vehicleType ? [
                    'vehicle_type_id' => $vehicle->vehicleType->uuid,
                    'title' => $vehicle->vehicleType->title,
                ] : null,
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
            'shipment_count' => $shipmentCount,
            'terminal_count' => $terminalCount,
            'stops' => VehicleActivityResource::collection($this->whenLoaded('vehicleActivities')),
            'track_points' => $this->when($isDetailResponse, $trackPoints->all()),
            'actual_stops' => $this->when($isDetailResponse, fn () => VehicleActivityResource::collection($actualStops)),
            'stats' => $this->when($isDetailResponse, [
                'duration_seconds' => $durationSeconds,
                'distance_km' => $distanceKm !== null ? round($distanceKm, 2) : null,
                'distance_source' => $distanceSource,
                'shipment_count' => $shipmentCount,
                'completed_shipments' => $completedShipments,
                'failed_shipments' => $failedShipments,
                'pending_shipments' => max(0, $shipmentCount - $terminalCount),
                'completion_percentage' => $shipmentCount > 0 ? (int) round(($terminalCount / $shipmentCount) * 100) : null,
                'stop_count' => $actualStops->count(),
                'average_moving_speed_kph' => $movingSpeedReadings->isNotEmpty() ? round($movingSpeedReadings->avg(), 2) : null,
                'maximum_speed_kph' => $speedReadings->isNotEmpty() ? round($speedReadings->max(), 2) : null,
            ]),
            'safety' => $this->when($isDetailResponse, [
                'speeding_event_count' => $speedingEvents->count(),
                'maximum_speed_kph' => $speedReadings->isNotEmpty() ? round($speedReadings->max(), 2) : null,
                'worst_speed_exceedance_kph' => $worstExceedance !== null ? round($worstExceedance, 2) : null,
                'speeding_events' => VehicleActivityResource::collection($speedingEvents),
            ]),
            'shipments' => $activeRunShipments
                ->sortBy(function ($runShipment) {
                    return $runShipment->sequence ?? PHP_INT_MAX;
                })
                ->values()
                ->map(function ($runShipment) use ($request) {
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
                        'odometer_at_collection' => $runShipment->shipment?->booking?->odometer_at_collection,
                        'odometer_at_delivery' => $runShipment->shipment?->booking?->odometer_at_delivery,
                        'total_km_from_collection' => $runShipment->shipment?->booking?->total_km_from_collection,
                        'collected_at' => $this->formatDateForMerchantTimezone(
                            $runShipment->shipment?->booking?->collected_at,
                            $request
                        ),
                        'delivered_at' => $this->formatDateForMerchantTimezone(
                            $runShipment->shipment?->booking?->delivered_at,
                            $request
                        ),
                        'pickup_location' => $runShipment->shipment?->pickupLocation
                            ? LocationResource::make($runShipment->shipment->pickupLocation)
                            : null,
                        'dropoff_location' => $runShipment->shipment?->dropoffLocation
                            ? LocationResource::make($runShipment->shipment->dropoffLocation)
                            : null,
                    ];
                })->all(),
            'created_at' => $this->formatDateForMerchantTimezone($this->created_at, $request),
            'updated_at' => $this->formatDateForMerchantTimezone($this->updated_at, $request),
            'delivery_note_imports' => DeliveryNoteImportResource::collection($this->whenLoaded('deliveryNoteImports')),
        ];
    }

    private function gpsDistanceKm(array $points): float
    {
        $distance = 0.0;

        for ($index = 1, $count = count($points); $index < $count; $index++) {
            $previous = $points[$index - 1];
            $current = $points[$index];
            $latitudeDelta = deg2rad($current['latitude'] - $previous['latitude']);
            $longitudeDelta = deg2rad($current['longitude'] - $previous['longitude']);
            $a = sin($latitudeDelta / 2) ** 2
                + cos(deg2rad($previous['latitude'])) * cos(deg2rad($current['latitude']))
                * sin($longitudeDelta / 2) ** 2;
            $a = min(1, max(0, $a));
            $distance += 6371.0088 * 2 * atan2(sqrt($a), sqrt(1 - $a));
        }

        return $distance;
    }
}
