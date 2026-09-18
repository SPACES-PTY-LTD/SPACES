<?php

namespace App\Services;

use App\Models\RunShipment;
use App\Models\Shipment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

class ShipmentReportSorter
{
    public function __construct(private readonly ShipmentVisitIntervalService $visits) {}

    public function paginate(Builder $query, string $key, string $direction, int $perPage): LengthAwarePaginator
    {
        $visitKeys = ['from_time_in', 'from_time_out', 'from_total_time', 'to_time_in', 'to_time_out', 'to_total_time'];
        $isVisit = in_array($key, $visitKeys, true);
        $relations = match ($key) {
            'from_location' => ['pickupLocation'],
            'to_location' => ['dropoffLocation'],
            'total_km_from_collection' => ['booking'],
            'run_duration_seconds', 'run_odometer_distance_km' => ['runShipments.run'],
            default => $isVisit ? ['runShipments'] : null,
        };
        if ($relations === null) {
            return $query->paginate($perPage);
        }

        // Use the same visit resolver as the report, including run-level and
        // legacy-stage fallbacks. Keep only scalar sort keys between batches.
        $keys = [];
        $now = now();
        (clone $query)->reorder()->withoutEagerLoads()->with($relations)
            ->chunkById(200, function ($shipments) use (&$keys, $key, $isVisit, $now) {
                $visits = $isVisit ? $this->visits->resolveForShipments($shipments) : [];
                foreach ($shipments as $shipment) {
                    $value = null;
                    if ($isVisit) {
                        $visit = $visits[$shipment->id][str_starts_with($key, 'from_') ? 'pickup' : 'dropoff'] ?? null;
                        if (str_ends_with($key, '_total_time')) {
                            $seconds = $visit?->entered_at?->diffInSeconds($visit->exited_at ?? $now, false);
                            $value = $seconds !== null && $seconds >= 0 ? $seconds : null;
                        } else {
                            $value = (str_ends_with($key, '_in') ? $visit?->entered_at : $visit?->exited_at)?->getTimestamp();
                        }
                    } else {
                        $value = $this->value($shipment, $key);
                    }
                    $keys[] = ['id' => $shipment->id, 'value' => $value];
                }
            }, 'shipments.id', 'id');

        usort($keys, function ($a, $b) use ($direction) {
            if (($a['value'] === null) !== ($b['value'] === null)) {
                return $a['value'] === null ? 1 : -1;
            }
            $comparison = $a['value'] <=> $b['value'];
            return ($direction === 'desc' ? -$comparison : $comparison) ?: $b['id'] <=> $a['id'];
        });
        $page = LengthAwarePaginator::resolveCurrentPage();
        $ids = array_column(array_slice($keys, ($page - 1) * $perPage, $perPage), 'id');
        $shipments = (clone $query)->whereIn('shipments.id', $ids)->get()->keyBy('id');

        return new LengthAwarePaginator(collect($ids)->map(fn ($id) => $shipments->get($id))->filter()->values(), count($keys), $perPage, $page, [
            'path' => LengthAwarePaginator::resolveCurrentPath(),
        ]);
    }

    private function value(Shipment $shipment, string $key): mixed
    {
        if ($key === 'from_location' || $key === 'to_location') {
            $location = $key === 'from_location' ? $shipment->pickupLocation : $shipment->dropoffLocation;
            if (! $location) {
                return null;
            }
            $primary = trim(($location->name ?? '').($location->code ? ' ('.$location->code.')' : ''));
            return mb_strtolower($primary ?: ($location->address_line_1 ?? $location->city ?? $location->country ?? '-'));
        }
        if ($key === 'total_km_from_collection') {
            $value = $shipment->booking?->total_km_from_collection;
            return $value !== null ? (float) $value : null;
        }
        $run = $shipment->runShipments->where('status', '!=', RunShipment::STATUS_REMOVED)->sortByDesc('id')->first()?->run;
        if ($key === 'run_duration_seconds') {
            return $run?->started_at && $run?->completed_at ? $run->completed_at->diffInSeconds($run->started_at, true) : null;
        }
        return $run?->odometer_start_km !== null && $run?->odometer_end_km !== null
            ? max(0, $run->odometer_end_km - $run->odometer_start_km)
            : null;
    }
}
