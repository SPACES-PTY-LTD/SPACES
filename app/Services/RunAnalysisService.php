<?php

namespace App\Services;

use App\Jobs\AnalyzeRun;
use App\Models\LocationType;
use App\Models\Run;
use App\Models\RunAnalysis;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class RunAnalysisService
{
    public function request(Run $run, User $user, string $key): RunAnalysis
    {
        return DB::transaction(function () use ($run, $user, $key) {
            $run = Run::whereKey($run->id)->lockForUpdate()->firstOrFail();
            $query = RunAnalysis::where('run_id', $run->id)->where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id)->where('environment_id', $run->environment_id);
            if ($same = (clone $query)->where('request_key', $key)->first()) {
                return $same;
            }
            if ($pending = (clone $query)->whereIn('status', ['queued', 'processing'])->latest('id')->first()) {
                $expired = $pending->status === 'queued' ? $pending->created_at->lt(now()->subMinutes(15)) : $pending->started_at?->lt(now()->subMinutes(5));
                if (! $expired) {
                    return $pending;
                }
                $pending->update(['status' => 'failed', 'failure_message' => 'Analysis timed out. Please try again.', 'completed_at' => now()]);
            }
            $analysis = RunAnalysis::create(['run_id' => $run->id, 'account_id' => $run->account_id, 'merchant_id' => $run->merchant_id, 'environment_id' => $run->environment_id, 'requested_by' => $user->id, 'request_key' => $key, 'status' => 'queued']);
            AnalyzeRun::dispatch($analysis->id)->onConnection(config('services.openai.run_analysis_queue_connection', 'database'));

            return $analysis;
        });
    }

    public function validateReport(array $report, array $snapshot): array
    {
        Validator::make($report, [
            'conclusion' => 'required|string|max:1600', 'expected_ending' => 'required|string|max:1600', 'observed_ending' => 'required|string|max:1600',
            'limitations' => 'present|array|max:12', 'limitations.*' => 'string|max:1000',
            'red_flags' => 'present|array|max:6', 'red_flags.*.severity' => 'required|in:high,medium,low', 'red_flags.*.certainty' => 'required|in:confirmed,likely,insufficient_evidence',
            'red_flags.*.title' => 'required|string|max:200', 'red_flags.*.finding' => 'required|string|max:1600', 'red_flags.*.action' => 'required|string|max:1600', 'red_flags.*.details' => 'required|string|max:4000',
            'red_flags.*.evidence_ids' => 'present|array|max:30', 'red_flags.*.evidence_ids.*' => 'string',
            'missing_locations' => 'present|array|max:5', 'missing_locations.*.candidate_id' => 'required|string', 'missing_locations.*.reason' => 'required|string|max:1600', 'missing_locations.*.suggested_name' => 'required|string|max:200', 'missing_locations.*.location_type_id' => 'nullable|string',
        ])->validate();
        $ids = array_column($snapshot['events'], 'evidence_id');
        foreach ($report['red_flags'] as $flag) {
            if (array_diff($flag['evidence_ids'], $ids)) {
                throw new \RuntimeException('Unknown evidence reference.');
            }
        }
        $candidates = array_column($snapshot['missing_location_candidates'], 'candidate_id');
        $types = array_column($snapshot['location_types'], 'location_type_id');
        foreach ($report['missing_locations'] as $item) {
            if (! in_array($item['candidate_id'], $candidates, true) || ($item['location_type_id'] !== null && ! in_array($item['location_type_id'], $types, true))) {
                throw new \RuntimeException('Unknown location recommendation.');
            }
        }

        return array_intersect_key($report, array_flip(['conclusion', 'expected_ending', 'observed_ending', 'limitations', 'red_flags', 'missing_locations']));
    }

    public function prefill(Run $run, RunAnalysis $analysis, string $candidateId): array
    {
        $item = collect($analysis->report['missing_locations'] ?? [])->firstWhere('candidate_id', $candidateId);
        $candidate = app(RunAnalysisLocationDetails::class)->candidates($analysis)[$candidateId] ?? null;
        abort_unless($item && $candidate && $analysis->status === 'completed', 404);
        $matched = app(RunAnalysisSnapshot::class)->matchLocation(app(RunAnalysisSnapshot::class)->locations($run), $candidate['latitude'], $candidate['longitude']);
        if ($matched) {
            return ['existing_location_id' => $matched->uuid, 'initial_values' => null];
        }
        $type = $item['location_type_id'] ? LocationType::where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id)->where('uuid', $item['location_type_id'])->first() : null;

        return ['existing_location_id' => null, 'initial_values' => ['name' => $candidate['provider_name'] ?? $candidate['provider_address'] ?? $item['suggested_name'], 'address_line_1' => $candidate['provider_address'] ?? null, 'latitude' => $candidate['latitude'], 'longitude' => $candidate['longitude'], 'location_type_id' => $type?->uuid]];
    }
}
