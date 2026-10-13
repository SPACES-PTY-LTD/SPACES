<?php

namespace App\Support;

use App\Models\VehicleActivity;
use Illuminate\Database\Eloquent\Builder;

class RunActivityQuery
{
    /** Scoped activities for a run row, usable as a correlated aggregate. */
    public static function forRunRow(): Builder
    {
        return VehicleActivity::query()
            ->whereColumn('vehicle_activity.account_id', 'runs.account_id')
            ->whereColumn('vehicle_activity.merchant_id', 'runs.merchant_id')
            ->where(function (Builder $query) {
                $query->whereColumn('vehicle_activity.run_id', 'runs.id')
                    ->orWhere(function (Builder $window) {
                        $window->whereNull('vehicle_activity.run_id')
                            ->whereColumn('vehicle_activity.vehicle_id', 'runs.vehicle_id')
                            ->whereColumn('vehicle_activity.occurred_at', '>=', 'runs.started_at')
                            ->whereRaw('vehicle_activity.occurred_at <= COALESCE(runs.completed_at, ?)', [now()]);
                    });
            });
    }

    /** Include unassigned telemetry only within the run's actual vehicle/time window. */
    public static function forRuns(array $ids): Builder
    {
        return self::forRunRow()
            ->join('runs', 'runs.account_id', '=', 'vehicle_activity.account_id')
            ->whereIn('runs.id', $ids);
    }
}
