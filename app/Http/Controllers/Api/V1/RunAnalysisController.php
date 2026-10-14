<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Run;
use App\Models\RunAnalysis;
use App\Services\RunAnalysisLocationDetails;
use App\Services\RunAnalysisService;
use App\Services\RunAnalysisSnapshot;
use App\Support\ApiResponse;
use App\Support\MerchantAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class RunAnalysisController extends Controller
{
    private function run(Request $request, string $uuid): Run
    {
        abort_unless($request->user(), 403);
        $query = Run::where('uuid', $uuid);
        if ($env = $request->attributes->get('merchant_environment')) {
            $query->where('merchant_id', $env->merchant_id)->where('environment_id', $env->id);
        }
        if ($merchant = $request->header('X-Merchant-Id')) {
            $query->whereHas('merchant', fn ($q) => $q->where('uuid', $merchant));
        }
        $run = $query->firstOrFail();
        $this->authorize('view', $run);

        return $run;
    }

    public function show(Request $request, string $run_uuid)
    {
        $run = $this->run($request, $run_uuid);
        $q = RunAnalysis::where('run_id', $run->id)->where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id)->where('environment_id', $run->environment_id);
        $latest = (clone $q)->latest('id')->first();
        if ($latest && in_array($latest->status, ['queued', 'processing'])) {
            $expired = $latest->status === 'queued' ? $latest->created_at->lt(now()->subMinutes(15)) : $latest->started_at?->lt(now()->subMinutes(5));
            if ($expired) {
                $latest->update(['status' => 'failed', 'failure_message' => 'Analysis timed out. Please try again.', 'completed_at' => now()]);
            }
        }
        $saved = (clone $q)->where('status', 'completed')->latest('id')->first();
        $canCreate = MerchantAccess::isSuperAdmin($request->user()) || MerchantAccess::canCreateOrUpdateResources($request->user(), $run->merchant);

        return ApiResponse::success(['latest' => $this->summary($latest), 'saved' => $this->summary($saved),
            'stale' => $saved ? $saved->fingerprint !== app(RunAnalysisSnapshot::class)->cachedFingerprint($run) : false,
            'can_analyze' => Gate::allows('update', $run), 'can_create_location' => $canCreate,
            'configured' => (string) config('services.openai.api_key') !== '']);
    }

    public function store(Request $request, string $run_uuid, RunAnalysisService $service)
    {
        $run = $this->run($request, $run_uuid);
        $this->authorize('update', $run);
        $data = $request->validate(['request_key' => 'required|uuid']);
        if ((string) config('services.openai.api_key') === '') {
            return ApiResponse::error('AI_NOT_CONFIGURED', 'AI analysis is not configured.', [], 503);
        }

        return ApiResponse::success($this->summary($service->request($run, $request->user(), $data['request_key'])->refresh()), [], 202);
    }

    public function prefill(Request $request, string $run_uuid, string $analysis_uuid, string $candidate_uuid, RunAnalysisService $service)
    {
        $run = $this->run($request, $run_uuid);
        abort_unless(MerchantAccess::isSuperAdmin($request->user()) || MerchantAccess::canCreateOrUpdateResources($request->user(), $run->merchant), 403);
        $analysis = RunAnalysis::where('uuid', $analysis_uuid)->where('run_id', $run->id)->where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id)->where('environment_id', $run->environment_id)->firstOrFail();

        return ApiResponse::success($service->prefill($run, $analysis, $candidate_uuid));
    }

    private function summary(?RunAnalysis $analysis): ?array
    {
        if (! $analysis) {
            return null;
        }
        $evidenceIds = collect($analysis->report['red_flags'] ?? [])->pluck('evidence_ids')->flatten()->all();
        $locations = collect($analysis->input_snapshot['locations'] ?? [])->keyBy('location_id');
        $evidence = collect($analysis->input_snapshot['events'] ?? [])->whereIn('evidence_id', $evidenceIds)->map(fn ($event) => [
            'evidence_id' => $event['evidence_id'], 'event' => $event['event'], 'at' => $event['at'],
            'location' => $locations->get($event['location_id'])['name'] ?? null,
            'duration_seconds' => $event['duration_seconds'], 'expected_waiting_minutes' => $event['expected_waiting_minutes'],
        ])->values()->all();

        $report = $analysis->report;
        if ($report) {
            $candidates = app(RunAnalysisLocationDetails::class)->candidates($analysis);
            $report['missing_locations'] = array_map(function ($item) use ($candidates) {
                $candidate = $candidates[$item['candidate_id']] ?? [];

                return array_merge($item, array_intersect_key($candidate, array_flip(['provider_name', 'provider_address', 'description_source', 'latitude', 'longitude'])));
            }, $report['missing_locations'] ?? []);
        }

        return ['analysis_id' => $analysis->uuid, 'status' => $analysis->status, 'report' => $report,
            'error' => $analysis->failure_message, 'created_at' => $analysis->created_at?->toIso8601String(),
            'completed_at' => $analysis->completed_at?->toIso8601String(), 'as_of' => $analysis->input_snapshot['as_of'] ?? null,
            'timezone' => $analysis->input_snapshot['timezone'] ?? 'UTC', 'evidence' => $evidence];
    }
}
