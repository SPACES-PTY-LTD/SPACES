<?php

namespace App\Services;

use App\Models\Location;
use App\Models\Run;
use App\Models\RunCost;
use App\Models\VehicleActivity;
use Illuminate\Support\Facades\DB;

class RunCostService
{
    public function applyVisit(Run $run, Location $location, VehicleActivity $visit): void
    {
        if ($run->merchant_id !== $location->merchant_id || $run->environment_id !== $location->environment_id) {
            return;
        }
        DB::transaction(function () use ($run, $location, $visit) {
            // Serialize against retries; include tombstones so corrections stay removed.
            Run::whereKey($run->id)->lockForUpdate()->firstOrFail();
            foreach ($location->additionalCosts()->get() as $cost) {
                RunCost::withTrashed()->firstOrCreate([
                    'run_id' => $run->id,
                    'vehicle_activity_id' => $visit->id,
                    'location_cost_id' => $cost->id,
                ], [
                    'location_id' => $location->id,
                    'location_name' => $location->name,
                    'visited_at' => $visit->entered_at ?? $visit->occurred_at,
                    'source' => 'geofence',
                    'title' => $cost->title,
                    'amount' => $cost->amount,
                    'currency' => $cost->currency,
                ]);
            }
        });
    }
}
