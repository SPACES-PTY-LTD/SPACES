<?php

namespace App\Services;

use App\Models\DeliveryRoute;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\VehicleActivity;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

class RouteStatsService
{
    private const MOVING_SPEED_THRESHOLD_KMH = 5.0;
    private const RETURN_ARRIVAL_RADIUS_KM = 0.5;

    public function build(DeliveryRoute $route, array $filters = []): array
    {
        $window = $this->resolveWindow($filters);

        $latestRun = $this->latestCompletedRunForRoute($route, $window);
        if (!$latestRun) {
            return $this->emptyPayload($route, $window);
        }

        $summaryStats = $this->buildRunStats($latestRun, $route);
        $driverAverageRuns = $this->queryCompletedRuns($route->merchant_id)
            ->where('driver_id', $latestRun->driver_id)
            ->orderByDesc('completed_at')
            ->limit(10)
            ->get();
        $sameRouteAverageRuns = $this->queryCompletedRuns($route->merchant_id)
            ->where('route_id', $route->id)
            ->where('completed_at', '>=', CarbonImmutable::now()->subDays(30))
            ->orderByDesc('completed_at')
            ->limit(30)
            ->get();
        $fleetAverageRuns = $this->queryCompletedRuns($route->merchant_id)
            ->where('completed_at', '>=', CarbonImmutable::now()->subDays(30))
            ->orderByDesc('completed_at')
            ->limit(30)
            ->get();

        $driverAverages = $this->averageRunStats($driverAverageRuns, $route);
        $sameRouteAverages = $this->averageRunStats($sameRouteAverageRuns, $route);
        $fleetAverages = $this->averageRunStats($fleetAverageRuns, $route);

        return [
            'route_id' => $route->uuid,
            'generated_at' => CarbonImmutable::now('UTC')->toIso8601String(),
            'currency' => 'ZAR',
            'units' => [
                'distance' => 'km',
                'duration' => 'minutes',
                'speed' => 'km/h',
                'percent' => '%',
            ],
            'definitions' => [
                'moving_speed_threshold_kmh' => self::MOVING_SPEED_THRESHOLD_KMH,
                'return_arrival_radius_km' => self::RETURN_ARRIVAL_RADIUS_KM,
            ],
            'window' => [
                'from' => $window['from']?->toDateString(),
                'to' => $window['to']?->toDateString(),
                'latest_run_id' => $latestRun->uuid,
            ],
            'data_quality' => [
                'telemetry_coverage_pct' => $summaryStats['data_quality']['telemetry_coverage_pct'],
                'gps_points_count' => $summaryStats['data_quality']['gps_points_count'],
                'has_return_leg_confidence' => $summaryStats['return_to_collection']['returned_to_collection'],
            ],
            'summary' => $summaryStats['summary'],
            'return_to_collection' => $summaryStats['return_to_collection'],
            'averages' => [
                'driver_last_10_routes' => $driverAverages,
                'same_route_last_30_days' => $sameRouteAverages,
                'fleet_last_30_days' => $fleetAverages,
            ],
            'deltas' => [
                'vs_driver_avg_return_distance_km' => $this->delta(
                    $summaryStats['return_to_collection']['return_leg_distance_km'],
                    $driverAverages['avg_return_distance_km']
                ),
                'vs_route_avg_return_distance_km' => $this->delta(
                    $summaryStats['return_to_collection']['return_leg_distance_km'],
                    $sameRouteAverages['avg_return_distance_km']
                ),
                'vs_fleet_avg_return_distance_km' => $this->delta(
                    $summaryStats['return_to_collection']['return_leg_distance_km'],
                    $fleetAverages['avg_return_distance_km']
                ),
                'vs_driver_avg_idle_ratio_pct' => $this->delta(
                    $summaryStats['summary']['idle_ratio_pct'],
                    $driverAverages['avg_idle_ratio_pct']
                ),
            ],
            'time_breakdown' => [
                'driving_pct' => $summaryStats['summary']['utilization_pct'],
                'idle_pct' => $summaryStats['summary']['idle_ratio_pct'],
                'stopped_pct' => $this->round(($summaryStats['summary']['stop_time_min'] / max($summaryStats['summary']['total_route_duration_min'], 1)) * 100),
            ],
            'timeline' => $summaryStats['timeline'],
        ];
    }

    private function latestCompletedRunForRoute(DeliveryRoute $route, array $window): ?Run
    {
        $query = $this->queryCompletedRuns($route->merchant_id)->where('route_id', $route->id);
        if ($window['from'] && $window['to']) {
            $query->whereBetween('completed_at', [$window['from']->startOfDay(), $window['to']->endOfDay()]);
        }

        $run = $query->orderByDesc('completed_at')->first();
        if ($run) {
            return $run;
        }

        return $this->queryCompletedRuns($route->merchant_id)
            ->where('route_id', $route->id)
            ->orderByDesc('completed_at')
            ->first();
    }

    private function queryCompletedRuns(int $merchantId)
    {
        return Run::query()
            ->where('merchant_id', $merchantId)
            ->where('status', Run::STATUS_COMPLETED)
            ->whereNotNull('started_at')
            ->whereNotNull('completed_at');
    }

    private function buildRunStats(Run $run, DeliveryRoute $route): array
    {
        $route->loadMissing(['routeStops.location']);
        $run->loadMissing(['destinationLocation']);

        /** @var EloquentCollection<int, VehicleActivity> $activities */
        $activities = VehicleActivity::query()
            ->where('run_id', $run->id)
            ->orderBy('occurred_at')
            ->orderBy('id')
            ->get();

        $totalDurationSeconds = max(0, $run->completed_at->diffInSeconds($run->started_at));
        $segmentSeconds = 0;
        $drivingSeconds = 0;
        $idleSeconds = 0;
        $stopSeconds = 0;
        $distanceKm = 0.0;
        $movingDistanceKm = 0.0;

        $lastStopLocationId = $route->routeStops->sortByDesc('sequence')->first()?->location_id;
        $returnStartIndex = $this->findLastLocationIndex($activities, $lastStopLocationId);
        $returnDurationSeconds = 0;
        $returnDistanceKm = 0.0;
        $returnIdleSeconds = 0;
        $returnMovingDistanceKm = 0.0;

        $firstStopLocationIds = $route->routeStops->pluck('location_id')->filter()->values();
        $firstStopArrivalIndex = $this->findFirstLocationIndex($activities, $firstStopLocationIds);

        $depotToFirst = ['duration' => 0, 'distance' => 0.0, 'idle' => 0];
        $deliveryRun = ['duration' => 0, 'distance' => 0.0, 'idle' => 0];
        $returnLeg = ['duration' => 0, 'distance' => 0.0, 'idle' => 0];

        for ($index = 0; $index < $activities->count() - 1; $index++) {
            $current = $activities[$index];
            $next = $activities[$index + 1];
            if (!$current->occurred_at || !$next->occurred_at) {
                continue;
            }

            $seconds = max(0, $next->occurred_at->diffInSeconds($current->occurred_at));
            $segmentSeconds += $seconds;
            $isMoving = $this->isMovingEvent($current);
            $isStop = $this->isStopEvent($current);

            $segmentDistanceKm = $this->segmentDistanceKm($current, $next);
            $distanceKm += $segmentDistanceKm;

            if ($isMoving) {
                $drivingSeconds += $seconds;
                $movingDistanceKm += $segmentDistanceKm;
            } elseif ($isStop) {
                $stopSeconds += $seconds;
            } else {
                $idleSeconds += $seconds;
            }

            if ($returnStartIndex !== null && $index >= $returnStartIndex) {
                $returnDurationSeconds += $seconds;
                $returnDistanceKm += $segmentDistanceKm;
                if ($isMoving) {
                    $returnMovingDistanceKm += $segmentDistanceKm;
                } else {
                    $returnIdleSeconds += $seconds;
                }
            }

            if ($firstStopArrivalIndex !== null && $index < $firstStopArrivalIndex) {
                $depotToFirst['duration'] += $seconds;
                $depotToFirst['distance'] += $segmentDistanceKm;
                if (!$isMoving) {
                    $depotToFirst['idle'] += $seconds;
                }
                continue;
            }

            if ($returnStartIndex !== null && $index >= $returnStartIndex) {
                $returnLeg['duration'] += $seconds;
                $returnLeg['distance'] += $segmentDistanceKm;
                if (!$isMoving) {
                    $returnLeg['idle'] += $seconds;
                }
                continue;
            }

            $deliveryRun['duration'] += $seconds;
            $deliveryRun['distance'] += $segmentDistanceKm;
            if (!$isMoving) {
                $deliveryRun['idle'] += $seconds;
            }
        }

        $missingSeconds = max(0, $totalDurationSeconds - ($drivingSeconds + $idleSeconds + $stopSeconds));
        $idleSeconds += $missingSeconds;

        $plannedStops = $route->routeStops->count();
        $runShipmentStats = RunShipment::query()
            ->where('run_id', $run->id)
            ->selectRaw(
                "SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as done_count,
                 SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as failed_count,
                 SUM(CASE WHEN status != ? THEN 1 ELSE 0 END) as active_count",
                [RunShipment::STATUS_DONE, RunShipment::STATUS_FAILED, RunShipment::STATUS_REMOVED]
            )
            ->first();

        $completedStops = (int) ($runShipmentStats?->done_count ?? 0) + (int) ($runShipmentStats?->failed_count ?? 0);
        $onTimeStops = (int) ($runShipmentStats?->done_count ?? 0);
        $lateStops = max(0, $completedStops - $onTimeStops);

        $collectionPoint = $run->destinationLocation ?: $route->routeStops->sortBy('sequence')->first()?->location;
        $returnedToCollection = $this->returnedToCollection($activities, $collectionPoint?->id, $collectionPoint?->latitude, $collectionPoint?->longitude);

        $totalRouteDurationMin = $this->secondsToMinutes($totalDurationSeconds);
        $drivingTimeMin = $this->secondsToMinutes($drivingSeconds);
        $idleTimeMin = $this->secondsToMinutes($idleSeconds);
        $stopTimeMin = $this->secondsToMinutes($stopSeconds);
        $returnDurationMin = $this->secondsToMinutes($returnDurationSeconds);

        $plannedDistance = $route->estimated_distance !== null ? (float) $route->estimated_distance : null;
        $distanceVarianceKm = $plannedDistance !== null ? $distanceKm - $plannedDistance : null;
        $distanceVariancePct = ($plannedDistance !== null && $plannedDistance > 0)
            ? (($distanceKm - $plannedDistance) / $plannedDistance) * 100
            : null;

        $utilizationPct = $totalDurationSeconds > 0 ? ($drivingSeconds / $totalDurationSeconds) * 100 : 0;
        $idleRatioPct = $totalDurationSeconds > 0 ? ($idleSeconds / $totalDurationSeconds) * 100 : 0;
        $avgMovingSpeed = $drivingSeconds > 0 ? $movingDistanceKm / ($drivingSeconds / 3600) : 0;
        $returnAvgSpeed = $returnDurationSeconds > 0 ? $returnMovingDistanceKm / ($returnDurationSeconds / 3600) : 0;

        return [
            'summary' => [
                'planned_distance_km' => $plannedDistance !== null ? $this->round($plannedDistance) : null,
                'actual_distance_km' => $this->round($distanceKm),
                'distance_variance_km' => $distanceVarianceKm !== null ? $this->round($distanceVarianceKm) : null,
                'distance_variance_pct' => $distanceVariancePct !== null ? $this->round($distanceVariancePct) : null,
                'total_route_duration_min' => $totalRouteDurationMin,
                'driving_time_min' => $drivingTimeMin,
                'idle_time_min' => $idleTimeMin,
                'stop_time_min' => $stopTimeMin,
                'utilization_pct' => $this->round($utilizationPct),
                'idle_ratio_pct' => $this->round($idleRatioPct),
                'avg_moving_speed_kmh' => $this->round($avgMovingSpeed),
                'on_time_stops' => $onTimeStops,
                'late_stops' => $lateStops,
                'completed_stops' => $completedStops,
                'planned_stops' => $plannedStops,
            ],
            'return_to_collection' => [
                'collection_point_id' => $collectionPoint?->uuid,
                'collection_point_name' => $collectionPoint?->name ?? $collectionPoint?->code,
                'returned_to_collection' => $returnedToCollection,
                'return_leg_distance_km' => $this->round($returnDistanceKm),
                'return_leg_duration_min' => $returnDurationMin,
                'return_leg_avg_speed_kmh' => $this->round($returnAvgSpeed),
                'return_leg_idle_min' => $this->secondsToMinutes($returnIdleSeconds),
            ],
            'timeline' => [
                [
                    'segment' => 'depot_to_first_stop',
                    'distance_km' => $this->round($depotToFirst['distance']),
                    'duration_min' => $this->secondsToMinutes($depotToFirst['duration']),
                    'idle_min' => $this->secondsToMinutes($depotToFirst['idle']),
                ],
                [
                    'segment' => 'delivery_run',
                    'distance_km' => $this->round($deliveryRun['distance']),
                    'duration_min' => $this->secondsToMinutes($deliveryRun['duration']),
                    'idle_min' => $this->secondsToMinutes($deliveryRun['idle']),
                ],
                [
                    'segment' => 'return_to_collection',
                    'distance_km' => $this->round($returnLeg['distance']),
                    'duration_min' => $this->secondsToMinutes($returnLeg['duration']),
                    'idle_min' => $this->secondsToMinutes($returnLeg['idle']),
                ],
            ],
            'data_quality' => [
                'telemetry_coverage_pct' => $totalDurationSeconds > 0
                    ? $this->round(min(100, ($segmentSeconds / $totalDurationSeconds) * 100))
                    : 0.0,
                'gps_points_count' => $activities->filter(fn (VehicleActivity $activity) => $activity->latitude !== null && $activity->longitude !== null)->count(),
            ],
            '_run_average_fields' => [
                'avg_total_distance_km' => $this->round($distanceKm),
                'avg_return_distance_km' => $this->round($returnDistanceKm),
                'avg_return_duration_min' => $returnDurationMin,
                'avg_idle_ratio_pct' => $this->round($idleRatioPct),
            ],
        ];
    }

    private function averageRunStats(Collection $runs, DeliveryRoute $route): array
    {
        if ($runs->isEmpty()) {
            return [
                'avg_total_distance_km' => null,
                'avg_return_distance_km' => null,
                'avg_return_duration_min' => null,
                'avg_idle_ratio_pct' => null,
            ];
        }

        $accumulator = [
            'avg_total_distance_km' => 0.0,
            'avg_return_distance_km' => 0.0,
            'avg_return_duration_min' => 0.0,
            'avg_idle_ratio_pct' => 0.0,
        ];

        $count = 0;
        foreach ($runs as $run) {
            $stats = $this->buildRunStats($run, $this->resolveRouteForRun($run, $route));
            $fields = $stats['_run_average_fields'];
            $accumulator['avg_total_distance_km'] += $fields['avg_total_distance_km'] ?? 0;
            $accumulator['avg_return_distance_km'] += $fields['avg_return_distance_km'] ?? 0;
            $accumulator['avg_return_duration_min'] += $fields['avg_return_duration_min'] ?? 0;
            $accumulator['avg_idle_ratio_pct'] += $fields['avg_idle_ratio_pct'] ?? 0;
            $count++;
        }

        return [
            'avg_total_distance_km' => $count > 0 ? $this->round($accumulator['avg_total_distance_km'] / $count) : null,
            'avg_return_distance_km' => $count > 0 ? $this->round($accumulator['avg_return_distance_km'] / $count) : null,
            'avg_return_duration_min' => $count > 0 ? $this->round($accumulator['avg_return_duration_min'] / $count) : null,
            'avg_idle_ratio_pct' => $count > 0 ? $this->round($accumulator['avg_idle_ratio_pct'] / $count) : null,
        ];
    }

    private function resolveRouteForRun(Run $run, DeliveryRoute $fallbackRoute): DeliveryRoute
    {
        if ($run->route_id === $fallbackRoute->id) {
            return $fallbackRoute;
        }

        $runRoute = DeliveryRoute::query()->find($run->route_id);
        if ($runRoute) {
            return $runRoute;
        }

        return $fallbackRoute;
    }

    private function emptyPayload(DeliveryRoute $route, array $window): array
    {
        return [
            'route_id' => $route->uuid,
            'generated_at' => CarbonImmutable::now('UTC')->toIso8601String(),
            'currency' => 'ZAR',
            'units' => [
                'distance' => 'km',
                'duration' => 'minutes',
                'speed' => 'km/h',
                'percent' => '%',
            ],
            'definitions' => [
                'moving_speed_threshold_kmh' => self::MOVING_SPEED_THRESHOLD_KMH,
                'return_arrival_radius_km' => self::RETURN_ARRIVAL_RADIUS_KM,
            ],
            'window' => [
                'from' => $window['from']?->toDateString(),
                'to' => $window['to']?->toDateString(),
                'latest_run_id' => null,
            ],
            'data_quality' => [
                'telemetry_coverage_pct' => 0,
                'gps_points_count' => 0,
                'has_return_leg_confidence' => false,
            ],
            'summary' => [
                'planned_distance_km' => $route->estimated_distance !== null ? (float) $route->estimated_distance : null,
                'actual_distance_km' => null,
                'distance_variance_km' => null,
                'distance_variance_pct' => null,
                'total_route_duration_min' => 0,
                'driving_time_min' => 0,
                'idle_time_min' => 0,
                'stop_time_min' => 0,
                'utilization_pct' => 0,
                'idle_ratio_pct' => 0,
                'avg_moving_speed_kmh' => 0,
                'on_time_stops' => 0,
                'late_stops' => 0,
                'completed_stops' => 0,
                'planned_stops' => (int) $route->routeStops()->count(),
            ],
            'return_to_collection' => [
                'collection_point_id' => null,
                'collection_point_name' => null,
                'returned_to_collection' => false,
                'return_leg_distance_km' => 0,
                'return_leg_duration_min' => 0,
                'return_leg_avg_speed_kmh' => 0,
                'return_leg_idle_min' => 0,
            ],
            'averages' => [
                'driver_last_10_routes' => [
                    'avg_total_distance_km' => null,
                    'avg_return_distance_km' => null,
                    'avg_return_duration_min' => null,
                    'avg_idle_ratio_pct' => null,
                ],
                'same_route_last_30_days' => [
                    'avg_total_distance_km' => null,
                    'avg_return_distance_km' => null,
                    'avg_return_duration_min' => null,
                    'avg_idle_ratio_pct' => null,
                ],
                'fleet_last_30_days' => [
                    'avg_total_distance_km' => null,
                    'avg_return_distance_km' => null,
                    'avg_return_duration_min' => null,
                    'avg_idle_ratio_pct' => null,
                ],
            ],
            'deltas' => [
                'vs_driver_avg_return_distance_km' => null,
                'vs_route_avg_return_distance_km' => null,
                'vs_fleet_avg_return_distance_km' => null,
                'vs_driver_avg_idle_ratio_pct' => null,
            ],
            'time_breakdown' => [
                'driving_pct' => 0,
                'idle_pct' => 0,
                'stopped_pct' => 0,
            ],
            'timeline' => [
                [
                    'segment' => 'depot_to_first_stop',
                    'distance_km' => 0,
                    'duration_min' => 0,
                    'idle_min' => 0,
                ],
                [
                    'segment' => 'delivery_run',
                    'distance_km' => 0,
                    'duration_min' => 0,
                    'idle_min' => 0,
                ],
                [
                    'segment' => 'return_to_collection',
                    'distance_km' => 0,
                    'duration_min' => 0,
                    'idle_min' => 0,
                ],
            ],
        ];
    }

    private function returnedToCollection(
        EloquentCollection $activities,
        ?int $collectionLocationId,
        mixed $collectionLatitude,
        mixed $collectionLongitude
    ): bool {
        if ($activities->isEmpty()) {
            return false;
        }

        /** @var VehicleActivity|null $last */
        $last = $activities->last();
        if (!$last) {
            return false;
        }

        if ($collectionLocationId !== null && (int) $last->location_id === $collectionLocationId) {
            return true;
        }

        if ($collectionLatitude === null || $collectionLongitude === null || $last->latitude === null || $last->longitude === null) {
            return false;
        }

        return $this->distanceKm(
            (float) $last->latitude,
            (float) $last->longitude,
            (float) $collectionLatitude,
            (float) $collectionLongitude
        ) <= self::RETURN_ARRIVAL_RADIUS_KM;
    }

    private function findFirstLocationIndex(EloquentCollection $activities, Collection $locationIds): ?int
    {
        if ($locationIds->isEmpty()) {
            return null;
        }

        foreach ($activities as $index => $activity) {
            if ($activity->location_id !== null && $locationIds->contains((int) $activity->location_id)) {
                return $index;
            }
        }

        return null;
    }

    private function findLastLocationIndex(EloquentCollection $activities, ?int $locationId): ?int
    {
        if ($locationId === null) {
            return null;
        }

        for ($index = $activities->count() - 1; $index >= 0; $index--) {
            $activity = $activities[$index];
            if ((int) $activity->location_id === $locationId) {
                return $index;
            }
        }

        return null;
    }

    private function isMovingEvent(VehicleActivity $activity): bool
    {
        if ($activity->speed_kph !== null && (float) $activity->speed_kph >= self::MOVING_SPEED_THRESHOLD_KMH) {
            return true;
        }

        return in_array($activity->event_type, [
            VehicleActivity::EVENT_MOVING,
            VehicleActivity::EVENT_SPEEDING,
        ], true);
    }

    private function isStopEvent(VehicleActivity $activity): bool
    {
        if ($activity->location_id !== null) {
            return true;
        }

        return in_array($activity->event_type, [
            VehicleActivity::EVENT_STOPPED,
            VehicleActivity::EVENT_ENTERED_LOCATION,
            VehicleActivity::EVENT_EXITED_LOCATION,
            VehicleActivity::EVENT_SHIPMENT_COLLECTION,
            VehicleActivity::EVENT_SHIPMENT_DELIVERY,
        ], true);
    }

    private function segmentDistanceKm(VehicleActivity $current, VehicleActivity $next): float
    {
        if ($current->latitude === null || $current->longitude === null || $next->latitude === null || $next->longitude === null) {
            return 0;
        }

        return $this->distanceKm(
            (float) $current->latitude,
            (float) $current->longitude,
            (float) $next->latitude,
            (float) $next->longitude
        );
    }

    private function distanceKm(float $latA, float $lngA, float $latB, float $lngB): float
    {
        $earthRadiusKm = 6371.0;
        $latA = deg2rad($latA);
        $latB = deg2rad($latB);
        $deltaLat = $latB - $latA;
        $deltaLng = deg2rad($lngB - $lngA);

        $value = sin($deltaLat / 2) ** 2
            + cos($latA) * cos($latB) * sin($deltaLng / 2) ** 2;

        $arc = 2 * atan2(sqrt($value), sqrt(max(0, 1 - $value)));

        return $earthRadiusKm * $arc;
    }

    private function resolveWindow(array $filters): array
    {
        $from = !empty($filters['from']) ? CarbonImmutable::parse($filters['from']) : CarbonImmutable::now()->subDays(30);
        $to = !empty($filters['to']) ? CarbonImmutable::parse($filters['to']) : CarbonImmutable::now();

        if ($from->greaterThan($to)) {
            [$from, $to] = [$to, $from];
        }

        return ['from' => $from, 'to' => $to];
    }

    private function secondsToMinutes(int $seconds): int
    {
        return (int) round($seconds / 60);
    }

    private function round(float|int $value, int $precision = 2): float
    {
        return round((float) $value, $precision);
    }

    private function delta(?float $value, ?float $baseline): ?float
    {
        if ($value === null || $baseline === null) {
            return null;
        }

        return $this->round($value - $baseline);
    }
}
