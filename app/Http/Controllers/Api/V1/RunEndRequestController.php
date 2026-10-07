<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Run;
use App\Services\ActivityLogService;
use App\Services\RunService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RunEndRequestController extends Controller
{
    public function review(Request $request, string $run_uuid, string $request_uuid, RunService $service)
    {
        abort_if($request->user()->role === 'driver', 403, 'Dispatch approval is required.');
        $data = $request->validate(['decision' => ['required', 'in:approved,rejected'],
            'reason' => ['required_if:decision,rejected', 'nullable', 'string', 'max:2000', 'regex:/\S/u'],
            'confirm_early_closure' => ['required_if:decision,approved', 'boolean']]);
        $scoped = $service->getRunForUser($request->user(), $run_uuid, $request->attributes->get('merchant_environment'));
        $this->authorize('update', $scoped);

        return DB::transaction(function () use ($request, $scoped, $request_uuid, $data) {
            $run = Run::whereKey($scoped->id)->lockForUpdate()->firstOrFail();
            $entry = $run->endRequests()->where('uuid', $request_uuid)->lockForUpdate()->firstOrFail();
            if ($entry->status === $data['decision']) {
                return ApiResponse::success($entry->toSummary());
            }
            abort_unless($entry->status === 'pending' && $run->status === Run::STATUS_IN_PROGRESS, 409, 'This request or run has already been resolved. Refresh the run.');
            if ($data['decision'] === 'approved') {
                abort_unless($data['confirm_early_closure'] ?? false, 422, 'Confirm closure even if deliveries remain unfinished.');

            }
            $entry->update(['status' => $data['decision'], 'reviewed_by' => $request->user()->id, 'reviewed_at' => now(), 'review_reason' => isset($data['reason']) ? trim($data['reason']) : null]);
            if ($data['decision'] === 'approved') {
                $run->update(['status' => Run::STATUS_COMPLETED, 'completed_at' => now()]);
            }
            app(ActivityLogService::class)->log(action: 'run_end_'.$data['decision'], entityType: 'run', entity: $run, actor: $request->user(), changes: ['after' => $entry->toSummary()], title: 'Run end request '.$data['decision']);

            return ApiResponse::success($entry->toSummary());
        });
    }
}
