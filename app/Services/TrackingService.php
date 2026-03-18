<?php

namespace App\Services;

use App\Jobs\SyncTrackingJob;
use App\Models\Shipment;

class TrackingService
{
    public function listEvents(Shipment $shipment)
    {
        return $shipment->trackingEvents()
            ->with('merchant')
            ->orderBy('occurred_at')
            ->get();
    }

    public function maybeSync(Shipment $shipment, int $minutes = 15): void
    {
        $latest = $shipment->trackingEvents()->orderByDesc('occurred_at')->first();
        if (!$latest || $latest->occurred_at->lt(now()->subMinutes($minutes))) {
            SyncTrackingJob::dispatch($shipment->id);
        }
    }
}
