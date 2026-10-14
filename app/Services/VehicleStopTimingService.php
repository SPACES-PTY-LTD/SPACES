<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\Run;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use App\Support\RunDistance;
use Carbon\Carbon;
use Carbon\CarbonInterface;

/** Called under the lifecycle's vehicle-row lock; independent of GPS history rollout. */
class VehicleStopTimingService
{
    public function record(Vehicle $vehicle, Merchant $merchant, CarbonInterface $at, float $lat, float $lng, ?float $speed, bool $sourceTimeKnown, callable $create): void
    {
        $cursor = $vehicle->metadata['stop_timing_cursor'] ?? [];
        if (isset($cursor['at']) && $at->lessThanOrEqualTo(Carbon::parse($cursor['at']))) {
            return;
        }
        $runs = Run::where('account_id', $merchant->account_id)->where('merchant_id', $merchant->id)
            ->where('vehicle_id', $vehicle->id)->whereNotNull('started_at')->where('started_at', '<=', $at)
            ->where(fn ($q) => $q->whereNull('completed_at')->orWhere('completed_at', '>=', $at))
            ->where('status', '!=', Run::STATUS_CANCELLED)->limit(2)->get();
        $runId = $runs->count() === 1 ? $runs->first()->id : null;
        $stop = VehicleActivity::where('account_id', $merchant->account_id)->where('merchant_id', $merchant->id)
            ->where('vehicle_id', $vehicle->id)->where('event_type', VehicleActivity::EVENT_STOPPED)
            ->whereKey($cursor['activity_id'] ?? 0)->first();
        $timing = $stop?->metadata['stop_timing'] ?? null;
        $valid = $sourceTimeKnown && is_finite($lat) && is_finite($lng) && abs($lat) <= 90 && abs($lng) <= 180
            && $speed !== null && is_finite($speed) && $speed >= 0;
        $stationary = $valid && $speed <= config('vehicle_history.stationary_speed_kph', 3);
        if ($stop && $timing && $timing['status'] === 'open') {
            $gap = Carbon::parse($cursor['at'] ?? $timing['last_confirmed_at'])->diffInSeconds($at) > config('vehicle_history.gap_seconds', 300);
            $distance = RunDistance::gpsDistanceKm([
                ['latitude' => (float) $stop->latitude, 'longitude' => (float) $stop->longitude],
                ['latitude' => $lat, 'longitude' => $lng],
            ]) * 1000;
            $reason = ! $valid ? 'invalid_observation' : ($gap ? 'tracking_gap' :
                ($stop->run_id !== $runId ? 'run_changed' : ($stationary && $distance > config('vehicle_history.stationary_radius_metres', 25) ? 'position_changed' : null)));
            if ($reason) {
                $timing['status'] = 'incomplete';
                $timing['reason'] = $reason;
            } elseif ($stationary) {
                $timing['last_confirmed_at'] = $at->toIso8601String();
                $timing['sample_count']++;
                $timing['moving_at'] = null;
            } elseif (! empty($timing['moving_at'])) {
                // Two consecutive moving observations confirm departure at the first one.
                $timing['departed_at'] = $timing['moving_at'];
                $timing['status'] = 'completed';
            } else {
                $timing['moving_at'] = $at->toIso8601String();
            }
            $stop->metadata = array_merge($stop->metadata ?? [], ['stop_timing' => $timing]);
            $stop->save();
            if ($timing['status'] !== 'open') {
                $stop = null;
            }
        } else {
            $stop = null;
        }
        if (! $stop && $stationary) {
            $stop = $create($runId, [
                'version' => 1, 'status' => 'open', 'started_at' => $at->toIso8601String(),
                'last_confirmed_at' => $at->toIso8601String(), 'departed_at' => null,
                'sample_count' => 1, 'moving_at' => null,
                'gap_seconds' => (int) config('vehicle_history.gap_seconds', 300),
            ]);
        }
        $vehicle->metadata = array_merge($vehicle->metadata ?? [], ['stop_timing_cursor' => [
            'at' => $at->toIso8601String(), 'activity_id' => $stop?->id,
        ]]);
        $vehicle->save();
    }
}
