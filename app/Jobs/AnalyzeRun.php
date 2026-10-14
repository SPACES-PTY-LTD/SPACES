<?php

namespace App\Jobs;

use App\Models\RunAnalysis;
use App\Services\Integrations\OpenAIService;
use App\Services\RunAnalysisService;
use App\Services\RunAnalysisSnapshot;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class AnalyzeRun implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 240;

    public bool $failOnTimeout = true;

    public function __construct(public int $analysisId)
    {
        $this->afterCommit();
    }

    public function handle(RunAnalysisSnapshot $snapshots, OpenAIService $ai, RunAnalysisService $service): void
    {
        if (! RunAnalysis::whereKey($this->analysisId)->where('status', 'queued')->update(['status' => 'processing', 'started_at' => now()])) {
            return;
        }
        try {
            $analysis = RunAnalysis::findOrFail($this->analysisId);
            $run = $analysis->run;
            $requester = \App\Models\User::find($analysis->requested_by);
            if (! $requester || ! $run || ! \Illuminate\Support\Facades\Gate::forUser($requester)->allows('update', $run)) {
                throw new \RuntimeException('Analysis authorization changed.');
            }
            if (! $run || $run->account_id !== $analysis->account_id || $run->merchant_id !== $analysis->merchant_id || $run->environment_id !== $analysis->environment_id) {
                throw new \RuntimeException('Run context changed.');
            }
            $snapshot = $snapshots->build($run);
            $analysis->update(['input_snapshot' => $snapshot, 'fingerprint' => $snapshot['fingerprint']]);
            $result = $ai->analyzeRun($snapshot);
            $report = $service->validateReport($result['report'], $snapshot);
            RunAnalysis::whereKey($this->analysisId)->where('status', 'processing')->update(['report' => json_encode($report, JSON_THROW_ON_ERROR), 'model' => $result['model'], 'status' => 'completed', 'completed_at' => now()]);
        } catch (Throwable $e) {
            $this->failed($e);
            throw new \RuntimeException('Run analysis failed.');
        }
    }

    public function failed(?Throwable $e): void
    {
        // Do not expose provider responses, credentials or run snapshots to the UI/logs.
        RunAnalysis::whereKey($this->analysisId)->whereIn('status', ['queued', 'processing'])->update(['status' => 'failed', 'failure_message' => 'Analysis could not be completed. Please try again.', 'completed_at' => now()]);
    }
}
