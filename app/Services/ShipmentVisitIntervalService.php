<?php

namespace App\Services;

use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\VehicleActivity;
use Illuminate\Support\Collection;

class ShipmentVisitIntervalService
{
    /**
     * Resolve pickup and dropoff visit activities for each shipment.
     *
     * Real entered-location visits take precedence. Run/location matching
     * covers pickup visits recorded before an auto-created shipment existed;
     * shipment stage activities remain a fallback for legacy data.
     *
     * @param  Collection<int, Shipment>  $shipments
     * @return array<int, array{pickup: ?VehicleActivity, dropoff: ?VehicleActivity}>
     */
    public function resolveForShipments(Collection $shipments): array
    {
        $shipmentIds = $shipments->pluck('id')->filter()->values();
        if ($shipmentIds->isEmpty()) {
            return [];
        }

        $runIdsByShipment = $shipments->mapWithKeys(fn (Shipment $shipment) => [
            $shipment->id => $this->latestRunId($shipment),
        ]);
        $runIds = $runIdsByShipment->filter()->unique()->values();
        $locationIds = $shipments
            ->flatMap(fn (Shipment $shipment) => [
                $shipment->pickup_location_id,
                $shipment->dropoff_location_id,
            ])
            ->filter()
            ->unique()
            ->values();

        $visitMap = [];
        $visits = VehicleActivity::query()
            ->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
            ->whereIn('location_id', $locationIds)
            ->where(function ($query) use ($shipmentIds, $runIds) {
                $query->whereIn('shipment_id', $shipmentIds);

                if ($runIds->isNotEmpty()) {
                    $query->orWhereIn('run_id', $runIds);
                }
            })
            ->with(['merchant', 'vehicle.lastDriver.user', 'location', 'run.driver.user', 'shipment'])
            ->orderByDesc('id')
            ->get();

        foreach ($visits as $visit) {
            if ($visit->shipment_id) {
                $shipmentKey = 'shipment:'.$visit->shipment_id.':'.$visit->location_id;
                $visitMap[$shipmentKey] ??= $visit;
            }

            if ($visit->run_id) {
                $runKey = 'run:'.$visit->run_id.':'.$visit->location_id;
                $visitMap[$runKey] ??= $visit;
            }
        }

        $stageMap = [];
        $stageActivities = VehicleActivity::query()
            ->whereIn('shipment_id', $shipmentIds)
            ->whereIn('event_type', [
                VehicleActivity::EVENT_SHIPMENT_COLLECTION,
                VehicleActivity::EVENT_SHIPMENT_DELIVERY,
            ])
            ->with(['merchant', 'vehicle.lastDriver.user', 'location', 'run.driver.user', 'shipment'])
            ->orderByDesc('id')
            ->get();

        foreach ($stageActivities as $activity) {
            $key = $activity->shipment_id.':'.$activity->event_type;
            $stageMap[$key] ??= $activity;
        }

        $resolved = [];
        foreach ($shipments as $shipment) {
            $runId = $runIdsByShipment->get($shipment->id);
            $pickupVisit = $visitMap['shipment:'.$shipment->id.':'.$shipment->pickup_location_id]
                ?? ($runId ? ($visitMap['run:'.$runId.':'.$shipment->pickup_location_id] ?? null) : null)
                ?? ($stageMap[$shipment->id.':'.VehicleActivity::EVENT_SHIPMENT_COLLECTION] ?? null);
            $dropoffVisit = $visitMap['shipment:'.$shipment->id.':'.$shipment->dropoff_location_id]
                ?? ($runId ? ($visitMap['run:'.$runId.':'.$shipment->dropoff_location_id] ?? null) : null)
                ?? ($stageMap[$shipment->id.':'.VehicleActivity::EVENT_SHIPMENT_DELIVERY] ?? null);

            $resolved[$shipment->id] = [
                'pickup' => $pickupVisit,
                'dropoff' => $dropoffVisit,
            ];
        }

        return $resolved;
    }

    private function latestRunId(Shipment $shipment): ?int
    {
        $runShipment = $shipment->relationLoaded('runShipments')
            ? $shipment->runShipments
                ->where('status', '!=', RunShipment::STATUS_REMOVED)
                ->sortByDesc('id')
                ->first()
            : $shipment->runShipments()
                ->where('status', '!=', RunShipment::STATUS_REMOVED)
                ->orderByDesc('id')
                ->first();

        return $runShipment?->run_id ? (int) $runShipment->run_id : null;
    }
}
