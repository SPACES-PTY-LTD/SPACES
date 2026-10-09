<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\Run;
use App\Models\RunShipment;
use Illuminate\Support\Collection;

class DriverRunDataService
{
    public function shipments(?Run $run, Driver $driver): Collection
    {
        $assignments = $run ? $run->runShipments()
            ->where('status', '!=', RunShipment::STATUS_REMOVED)
            ->whereHas('shipment', fn ($query) => $query
                ->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id))
            ->with([
                'shipment.pickupLocation' => fn ($q) => $q->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id),
                'shipment.dropoffLocation' => fn ($q) => $q->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id), 'shipment.merchant', 'shipment.environment',
                'shipment.parcels', 'shipment.booking.pod.capturedBy', 'shipment.booking.currentDriver',
            ])
            ->orderBy('sequence')->orderBy('id')->get()
            : collect();

        return $assignments->map(function ($assignment) use ($run) {
            $assignment->setRelation('run', $run);
            $assignment->shipment->setRelation('currentRunShipment', $assignment);

            return $assignment->shipment;
        })->unique('id')->values();
    }

    private function coordinate($source): array
    {
        $lat = $source?->latitude;
        $lng = $source?->longitude;
        $valid = is_numeric($lat) && is_numeric($lng) && is_finite((float) $lat) && is_finite((float) $lng)
            && abs((float) $lat) <= 90 && abs((float) $lng) <= 180;

        return ['latitude' => $valid ? (float) $lat : null, 'longitude' => $valid ? (float) $lng : null];
    }

    public function timeline(?Run $run, Driver $driver, Collection $runShipments): array
    {
        $activities = $run ? $run->vehicleActivities()
            ->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)
            ->whereIn('event_type', ['stopped', 'entered_location', 'shipment_collection', 'shipment_delivery', 'speeding'])
            ->with(['location' => fn ($query) => $query->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)])
            ->get() : collect();
        $recordedStops = $activities->groupBy(function ($stop) {
            if ($stop->event_type === 'speeding') {
                return $stop->uuid;
            }
            // Stage events from the same recorded visit share a location and arrival time.
            $arrival = $stop->entered_at ?? $stop->occurred_at;

            return $stop->location_id && $arrival ? $stop->location_id.':'.$arrival->toIso8601String() : $stop->uuid;
        })->map(function ($events) use ($runShipments) {
            $stop = $events->first();
            if ($stop->event_type === 'speeding') {
                return [
                    'stop_id' => $stop->uuid, 'kind' => 'Speeding', 'location_id' => null,
                    'name' => $stop->location?->name ?: 'Speeding event',
                    'address' => $stop->location?->full_address,
                    ...$this->coordinate($stop),
                    'occurred_at' => $stop->occurred_at?->toIso8601String(), 'exited_at' => null,
                    'speed_kph' => $stop->speed_kph !== null ? (float) $stop->speed_kph : null,
                    'speed_limit_kph' => $stop->speed_limit_kph !== null ? (float) $stop->speed_limit_kph : null,
                    'shipments' => collect(),
                ];
            }
            $types = $events->pluck('event_type');
            $isCollection = $types->contains('shipment_collection');
            $isDelivery = $types->contains('shipment_delivery');
            $linked = $runShipments->filter(fn ($shipment) => $events->pluck('shipment_id')->contains($shipment->id)
                || $events->pluck('uuid')->contains($shipment->metadata['matched_stop_id'] ?? null)
                || ($stop->location_id && in_array($stop->location_id, [$shipment->pickup_location_id, $shipment->dropoff_location_id])));
            if ($linked->contains(fn ($s) => $events->pluck('uuid')->contains($s->metadata['matched_stop_id'] ?? null))) {
                $isDelivery = true;
            }
            if (! $isCollection && ! $isDelivery && $stop->location_id) {
                $isCollection = $linked->contains('pickup_location_id', $stop->location_id);
                $isDelivery = $linked->contains('dropoff_location_id', $stop->location_id);
            }
            $kind = $isCollection && $isDelivery ? 'Collection / delivery' : ($isCollection ? 'Collection' : ($isDelivery ? 'Delivery' : 'Stop'));
            $shipment = $linked->first();
            $location = $stop->location ?? ($isCollection ? $shipment?->pickupLocation : ($isDelivery ? $shipment?->dropoffLocation : null));

            return [
                'stop_id' => $stop->uuid,
                'kind' => $kind,
                'location_id' => $location?->uuid,
                'name' => $location?->name ?: 'Truck stop',
                'address' => $location?->full_address,
                ...$this->coordinate($location ?? $stop),
                'occurred_at' => ($stop->entered_at ?? $stop->occurred_at)?->toIso8601String(),
                'exited_at' => $events->pluck('exited_at')->filter()->max()?->toIso8601String(),
                'shipments' => $linked->map(fn ($s) => ['shipment_id' => $s->uuid, 'reference' => $s->merchant_order_ref])->values(),
            ];
        })->sortBy('occurred_at')->values();

        $plannedDeliveryStops = $runShipments->filter(fn ($shipment) => ! in_array($shipment->status, ['delivered', 'failed', 'cancelled', 'returned'])
        )
            ->groupBy(fn ($shipment) => $shipment->dropoff_location_id ?: 'shipment:'.$shipment->id)
            ->map(function ($shipments) {
                $first = $shipments->first();

                return [
                    'stop_id' => 'planned:'.($first->dropoffLocation?->uuid ?? $first->uuid),
                    'kind' => 'Delivery', 'planned' => true,
                    'location_id' => $first->dropoffLocation?->uuid,
                    'name' => $first->dropoffLocation?->name ?: 'Delivery location not provided',
                    'address' => $first->dropoffLocation?->full_address,
                    ...$this->coordinate($first->dropoffLocation),
                    'occurred_at' => null, 'exited_at' => null,
                    'shipments' => $shipments->map(fn ($s) => ['shipment_id' => $s->uuid, 'reference' => $s->merchant_order_ref])->values(),
                ];
            })->values();

        if ($run?->destinationLocation
            && $run->destinationLocation->account_id === $driver->account_id
            && $run->destinationLocation->merchant_id === $driver->merchant_id) {
            $end = $run->destinationLocation;
            $plannedDeliveryStops->push(['stop_id' => 'planned-end:'.$end->uuid, 'kind' => 'Planned end', 'planned' => true,
                'location_id' => $end->uuid, 'name' => $end->name, 'address' => $end->full_address, ...$this->coordinate($end), 'occurred_at' => null, 'exited_at' => null, 'shipments' => collect()]);
        }

        return ['recorded_stops' => $recordedStops, 'planned_delivery_stops' => $plannedDeliveryStops];
    }
}
