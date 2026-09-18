<?php

namespace App\Services;

use App\Models\Run;
use App\Models\VehicleActivity;
use App\Models\VehicleLocationHistory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class RunTrackService
{
    public function get(Run $run, ?string $before = null): array
    {
        if (! config('vehicle_history.display_enabled')) {
            return $this->empty('disabled');
        }
        $cursor = null;
        if ($before !== null) {
            $cursor = json_decode(base64_decode($before, true) ?: '', true);
            if (! is_array($cursor) || count($cursor) !== 2 || ! is_string($cursor[0]) || ! preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/', $cursor[0]) || ! is_int($cursor[1])) {
                throw ValidationException::withMessages(['before' => 'Invalid track cursor.']);
            }
        }
        $version = Cache::get('run-track-version:'.$run->id, 'initial');
        $cacheKey = 'run-track:'.$run->account_id.':'.$run->merchant_id.':'.$run->id.':'.$version.':'.md5($before ?? '');

        return Cache::remember($cacheKey, $run->completed_at ? 86400 : 15, function () use ($run, $cursor) {
            $started = hrtime(true);
            $track = $this->build($run, $cursor);
            Log::info('vehicle_history.route', ['run_id' => $run->id, 'coordinates' => $track['coverage']['displayed_coordinates'], 'response_bytes' => strlen(json_encode($track)), 'duration_ms' => round((hrtime(true) - $started) / 1000000, 2)]);

            return $track;
        });
    }

    private function empty(string $status): array
    {
        return ['status' => $status, 'source' => 'recorded_gps', 'segments' => [], 'stops' => [], 'updated_at' => null, 'latest_observed_at' => null, 'active' => false, 'coverage' => ['partial' => false, 'next_before' => null, 'displayed_coordinates' => 0]];
    }

    private function build(Run $run, ?array $cursor): array
    {
        $query = VehicleLocationHistory::where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id)->where('run_id', $run->id);
        if ($cursor) {
            $query->where(fn ($q) => $q->where('observed_at', '<', $cursor[0])->orWhere(fn ($q) => $q->where('observed_at', $cursor[0])->where('id', '<', $cursor[1])));
        }
        $limit = (int) config('vehicle_history.read_batch', 10000);
        $rows = $query->orderByDesc('observed_at')->orderByDesc('id')->limit($limit + 1)->get();
        $hasMore = $rows->count() > $limit;
        $rows = $rows->take($limit)->reverse()->values();
        if ($rows->isEmpty()) {
            return $cursor ? $this->empty('empty') : $this->legacy($run);
        }
        $segments = [];
        $segment = [];
        $previous = null;
        foreach ($rows as $row) {
            $gap = $previous && ($previous->last_seen_at->diffInSeconds($row->observed_at, false) > config('vehicle_history.gap_seconds') || $row->observed_at->lessThan($previous->last_seen_at) || $row->delayed || $previous->delayed);
            if ($gap && $segment) {
                $segments[] = $segment;
                $segment = [];
            }
            $point = ['latitude' => $row->latitude, 'longitude' => $row->longitude, 'observed_at' => $row->observed_at->toIso8601String(), '_row' => $row, '_keep' => $row->stationary];
            $segment[] = $point;
            if ($row->stationary && $row->last_seen_at->greaterThan($row->observed_at)) {
                $segment[] = array_merge($point, ['latitude' => $row->last_latitude, 'longitude' => $row->last_longitude, 'observed_at' => $row->last_seen_at->toIso8601String()]);
            }
            $previous = $row;
        }
        if ($segment) {
            $segments[] = $segment;
        }
        foreach ($segments as &$points) {
            $points[0]['_keep'] = true;
            $points[count($points) - 1]['_keep'] = true;
        } unset($points);
        $max = min(2000, max(2, (int) config('vehicle_history.max_coordinates', 2000)));
        $flat = collect($segments)->flatten(1);
        // Pathological histories with thousands of boundaries use an explicit older window.
        $boundaryCount = $flat->where('_keep', true)->count();
        while ($boundaryCount > $max && count($segments) > 1) {
            $removed = array_shift($segments);
            $boundaryCount -= count(array_filter($removed, fn ($p) => $p['_keep']));
            $hasMore = true;
        }
        $flat = collect($segments)->flatten(1);
        if ($flat->where('_keep', true)->count() > $max) {
            $points = $segments[0];
            $required = $flat->where('_keep', true)->count();
            $cut = 0;
            do {
                $removed = $points[$cut++];
                if ($removed['_keep']) {
                    $required--;
                }
                $first = $points[$cut];
            } while ($required + (! $first['_keep'] ? 1 : 0) > $max || $first['_row']->id === $removed['_row']->id);
            $points = array_slice($points, $cut);
            $points[0]['_keep'] = true;
            $segments = [$points];
            $hasMore = true;
            $flat = collect($points);
        }
        $mandatory = $flat->where('_keep', true)->count();
        $optional = $flat->count() - $mandatory;
        $budget = max(0, $max - $mandatory);
        $seen = 0;
        $taken = 0;
        $selectedRows = [];
        $output = [];
        foreach ($segments as $points) {
            $out = [];
            foreach ($points as $point) {
                $keep = $point['_keep'];
                if (! $keep) {
                    $seen++;
                    $target = $optional ? (int) floor($seen * min($budget, $optional) / $optional) : 0;
                    $keep = $target > $taken;
                    if ($keep) {
                        $taken++;
                    }
                }
                if (! $keep) {
                    continue;
                }
                $selectedRows[$point['_row']->id] = $point['_row'];
                unset($point['_row'], $point['_keep']);
                $out[] = $point;
            }
            if ($out) {
                $output[] = $out;
            }
        }
        $first = reset($selectedRows);
        $stops = collect($selectedRows)->filter(fn ($row) => $row->stationary)->map(fn ($row) => [
            'latitude' => $row->latitude, 'longitude' => $row->longitude,
            'first_seen_at' => $row->observed_at->toIso8601String(), 'last_seen_at' => $row->last_seen_at->toIso8601String(),
            'sample_count' => $row->sample_count,
        ])->values()->all();

        $windowed = $hasMore || $cursor !== null;
        $startedLate = ! $windowed && $run->started_at && $run->started_at->diffInSeconds($first->observed_at, false) > config('vehicle_history.gap_seconds');
        $endedEarly = ! $cursor && $run->completed_at && $rows->max('last_seen_at')->diffInSeconds($run->completed_at, false) > config('vehicle_history.gap_seconds');
        $estimatedTimes = $rows->contains(fn ($row) => ! $row->source_time_known);

        return [
            'status' => 'ready', 'source' => 'recorded_gps', 'segments' => $output, 'stops' => $stops,
            'active' => ! $run->completed_at && $run->status !== Run::STATUS_CANCELLED,
            'updated_at' => $rows->max('received_at')->toIso8601String(),
            'latest_observed_at' => $rows->max('last_seen_at')->toIso8601String(),
            'coverage' => ['partial' => $windowed || count($output) > 1 || $startedLate || $endedEarly || $estimatedTimes, 'windowed' => $windowed, 'started_late' => (bool) $startedLate, 'ended_early' => (bool) $endedEarly, 'estimated_timestamps' => $estimatedTimes, 'next_before' => $hasMore ? base64_encode(json_encode([$first->observed_at->format('Y-m-d H:i:s.u'), $first->id])) : null,
                'from' => $first->observed_at->toIso8601String(), 'to' => $rows->max('last_seen_at')->toIso8601String(),
                'displayed_coordinates' => array_sum(array_map('count', $output)), 'gap_count' => max(0, count($output) - 1)],
        ];
    }

    private function legacy(Run $run): array
    {
        $points = VehicleActivity::where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id)->where('run_id', $run->id)
            ->whereNotNull('latitude')->whereNotNull('longitude')->orderByDesc('occurred_at')->orderByDesc('id')->limit(2000)->get()->reverse();
        $segments = [];
        $segment = [];
        $previous = null;
        foreach ($points as $point) {
            if ($previous && $previous->diffInSeconds($point->occurred_at) > config('vehicle_history.gap_seconds')) {
                if ($segment) {
                    $segments[] = $segment;
                } $segment = [];
            }
            $segment[] = ['latitude' => (float) $point->latitude, 'longitude' => (float) $point->longitude, 'observed_at' => $point->occurred_at->toIso8601String()];
            $previous = $point->occurred_at;
        }
        if ($segment) {
            $segments[] = $segment;
        }

        return array_replace($this->empty($segments ? 'ready' : 'empty'), ['source' => 'limited_history', 'segments' => $segments, 'coverage' => ['partial' => true, 'next_before' => null, 'displayed_coordinates' => $points->count()], 'active' => ! $run->completed_at]);
    }
}
