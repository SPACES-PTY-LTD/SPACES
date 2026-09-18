<?php

namespace App\Services;

use App\Models\MerchantIntegration;
use App\Models\Run;
use App\Models\Vehicle;
use App\Models\VehicleLocationHistory;
use App\Support\RunDistance;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class VehicleLocationHistoryService
{
    public function lockVehicle(int $vehicleId): Vehicle
    {
        // SQLite has no SELECT FOR UPDATE: acquire its writer lock before reading.
        if (DB::getDriverName() === 'sqlite') {
            DB::table('vehicles')->where('id', $vehicleId)->update(['id' => DB::raw('id')]);
        }

        return Vehicle::whereKey($vehicleId)->lockForUpdate()->firstOrFail();
    }

    public function record(Vehicle $vehicle, MerchantIntegration $integration, CarbonInterface $at, ?float $lat, ?float $lng, ?float $speed, ?float $odometer, bool $sourceTimeKnown = true, ?string $deliveryKey = null): ?VehicleLocationHistory
    {
        if (! config('vehicle_history.recording_enabled')) {
            return null;
        }
        if ($lat === null || $lng === null || ! is_finite($lat) || ! is_finite($lng) || abs($lat) > 90 || abs($lng) > 180) {
            Log::warning('vehicle_history.invalid_coordinate', ['vehicle_id' => $vehicle->id]);

            return null;
        }
        $at = $at->copy()->utc();
        $key = hash('sha256', json_encode([$vehicle->id, $integration->id, $sourceTimeKnown ? $at->format('Y-m-d H:i:s.u') : $deliveryKey, $lat, $lng, $speed, $odometer]));

        return DB::transaction(function () use ($vehicle, $integration, $at, $lat, $lng, $speed, $odometer, $sourceTimeKnown, $key) {
            $this->lockVehicle($vehicle->id);
            $inserted = DB::table('vehicle_location_receipts')->insertOrIgnore(['sample_key' => $key, 'vehicle_id' => $vehicle->id, 'observed_at' => $at]);
            $runs = Run::where('account_id', $vehicle->account_id)->where('merchant_id', $integration->merchant_id)
                ->where(fn ($q) => $q->where('status', '!=', Run::STATUS_CANCELLED)->orWhereNotNull('completed_at'))
                ->where('vehicle_id', $vehicle->id)->whereNotNull('started_at')->where('started_at', '<=', $at)
                ->where(fn ($q) => $q->whereNull('completed_at')->orWhere('completed_at', '>=', $at))->limit(2)->get();
            $runId = $runs->count() === 1 ? $runs->first()->id : null;
            if ($runs->count() > 1) {
                Log::warning('vehicle_history.ambiguous_run', ['vehicle_id' => $vehicle->id, 'observed_at' => $at->toIso8601String()]);
            }
            // Also invalidate on retries if a previous post-commit cache write failed.
            if ($runId) {
                DB::afterCommit(fn () => Cache::put('run-track-version:'.$runId, (string) \Illuminate\Support\Str::uuid(), now()->addYears(10)));
            }
            if (! $inserted) {
                return null;
            }
            $last = VehicleLocationHistory::where('vehicle_id', $vehicle->id)->orderByDesc('last_seen_at')->orderByDesc('id')->first();
            $stationary = $speed !== null && $speed >= 0 && $speed <= config('vehicle_history.stationary_speed_kph');
            $delayed = $last && $at->lessThanOrEqualTo($last->last_seen_at);
            $merge = $last && ! $delayed && $last->stationary && $stationary
                && $last->run_id === $runId && $last->merchant_integration_id === $integration->id
                && $last->merchant_id === $integration->merchant_id
                && $last->last_seen_at->diffInSeconds($at) <= config('vehicle_history.gap_seconds')
                && RunDistance::gpsDistanceKm([['latitude' => $last->latitude, 'longitude' => $last->longitude], ['latitude' => $lat, 'longitude' => $lng]]) * 1000 <= config('vehicle_history.stationary_radius_metres');
            $latest = ['last_seen_at' => $at, 'received_at' => now(), 'last_latitude' => $lat, 'last_longitude' => $lng, 'speed_kph' => $speed, 'odometer_km' => $odometer];
            if ($merge) {
                $last->source_time_known = $last->source_time_known && $sourceTimeKnown;
                $last->fill($latest)->sample_count++;
                $last->save();
                $record = $last;
            } else {
                $record = VehicleLocationHistory::create($latest + [
                    'account_id' => $vehicle->account_id, 'merchant_id' => $integration->merchant_id,
                    'vehicle_id' => $vehicle->id, 'merchant_integration_id' => $integration->id, 'run_id' => $runId,
                    'observed_at' => $at, 'latitude' => $lat, 'longitude' => $lng,
                    'stationary' => $stationary, 'delayed' => (bool) $delayed,
                    'source_time_known' => $sourceTimeKnown, 'first_sample_key' => $key,
                ]);
            }

            return $record;
        }, 3);
    }
}
