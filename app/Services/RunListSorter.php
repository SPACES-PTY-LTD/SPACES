<?php

namespace App\Services;

use App\Models\Run;
use App\Models\RunShipment;
use App\Support\CostMoney;
use App\Support\RunDistance;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

class RunListSorter
{
    public function paginate(Builder $query, array $filters, int $perPage): LengthAwarePaginator
    {
        $key = is_string($filters['sort_by'] ?? null) ? $filters['sort_by'] : '';
        $direction = ($filters['sort_dir'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
        $columns = ['run_id' => 'uuid', 'status' => 'status', 'start' => 'COALESCE(started_at, planned_start_at, created_at)'];
        if (isset($columns[$key])) {
            return $query->orderByRaw($columns[$key].' '.$direction)->orderBy('uuid')->paginate($perPage);
        }
        if ($key === 'shipment_count') {
            return $query->withCount(['runShipments as sort_count' => fn ($q) => $q->where('status', '!=', RunShipment::STATUS_REMOVED)])
                ->orderBy('sort_count', $direction)->orderBy('uuid')->paginate($perPage);
        }

        $relations = match ($key) {
            'duration' => [],
            'distance' => ['vehicleActivities:id,run_id,latitude,longitude,occurred_at'],
            'additional_costs' => ['additionalCosts'],
            'origin' => ['originLocation', 'runShipments.shipment.pickupLocation'],
            'destination' => ['destinationLocation', 'runShipments.shipment.dropoffLocation'],
            'driver' => ['driver.user'],
            'vehicle' => ['vehicle'],
            default => null,
        };
        if ($relations === null) {
            return $query->orderByDesc('created_at')->orderBy('uuid')->paginate($perPage);
        }

        // Compute display-derived keys in bounded batches. Only hydrate the full
        // response relationships for the selected page, not every matching run.
        $keys = [];
        (clone $query)->withoutEagerLoads()->with($relations)->chunkById(250, function ($runs) use (&$keys, $key) {
            foreach ($runs as $run) {
                $keys[] = ['id' => $run->id, 'uuid' => $run->uuid, 'value' => $this->value($run, $key)];
            }
        });
        usort($keys, function ($a, $b) use ($direction) {
            // Missing values stay last in either direction.
            if (($a['value'] === null) !== ($b['value'] === null)) {
                return $a['value'] === null ? 1 : -1;
            }
            $comparison = $a['value'] <=> $b['value'];
            if (is_array($a['value']) && is_array($b['value'])) {
                $comparison = 0;
                foreach ($a['value'] as $index => $total) {
                    if (! isset($b['value'][$index])) {
                        $comparison = 1;
                        break;
                    }
                    $comparison = $total <=> $b['value'][$index];
                    if ($comparison !== 0) {
                        break;
                    }
                }
                $comparison = $comparison ?: count($a['value']) <=> count($b['value']);
            }
            return ($direction === 'desc' ? -$comparison : $comparison) ?: strcmp($a['uuid'], $b['uuid']);
        });
        $page = LengthAwarePaginator::resolveCurrentPage();
        $ids = array_column(array_slice($keys, ($page - 1) * $perPage, $perPage), 'id');
        $runs = (clone $query)->whereIn('runs.id', $ids)->get()->keyBy('id');

        return new LengthAwarePaginator(collect($ids)->map(fn ($id) => $runs->get($id))->filter()->values(), count($keys), $perPage, $page, [
            'path' => LengthAwarePaginator::resolveCurrentPath(),
        ]);
    }

    private function value(Run $run, string $key): mixed
    {
        if ($key === 'duration') {
            return $run->started_at && $run->completed_at ? $run->completed_at->diffInSeconds($run->started_at, true) : null;
        }
        if ($key === 'distance') {
            if ($run->odometer_start_km !== null && $run->odometer_end_km !== null) {
                return max(0, $run->odometer_end_km - $run->odometer_start_km);
            }
            $points = $run->vehicleActivities->filter(fn ($activity) => $activity->latitude !== null && $activity->longitude !== null)
                ->map(fn ($activity) => ['latitude' => (float) $activity->latitude, 'longitude' => (float) $activity->longitude])->values()->all();
            return count($points) > 1 ? round(RunDistance::gpsDistanceKm($points), 2) : null;
        }
        if ($key === 'additional_costs') {
            // Compare currency codes, then numeric totals; never add different currencies.
            $totals = CostMoney::totals($run->additionalCosts);
            return $totals ? array_map(fn ($total) => [$total['currency'], CostMoney::units($total['amount'])], $totals) : null;
        }
        if ($key === 'driver') {
            return mb_strtolower($run->driver?->user?->name ?: 'Unassigned');
        }
        if ($key === 'vehicle') {
            return mb_strtolower($run->vehicle?->plate_number ?: ($run->vehicle?->ref_code ?: 'Unassigned'));
        }
        $shipments = $run->runShipments->where('status', '!=', RunShipment::STATUS_REMOVED)
            ->sortBy(fn ($shipment) => $shipment->sequence ?? PHP_INT_MAX);
        $location = $key === 'origin'
            ? ($run->originLocation ?? $shipments->first()?->shipment?->pickupLocation)
            : ($run->destinationLocation ?? $shipments->last()?->shipment?->dropoffLocation);
        return $location ? mb_strtolower($location->name ?: ($location->company ?: ($location->full_address ?: '-'))) : null;
    }
}
