<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Run;
use App\Services\RunActionsService;
use App\Services\RunService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RunActionsController extends Controller
{
    private function editable(Request $request, string $uuid): Run
    {
        abort_if($request->user()->role === 'driver', 403);
        $scoped = app(RunService::class)->getRunForUser($request->user(), $uuid, $request->attributes->get('merchant_environment'));
        $this->authorize('update', $scoped);
        $run = Run::whereKey($scoped->id)->lockForUpdate()->firstOrFail();
        abort_unless(in_array($run->status, [Run::STATUS_DRAFT, Run::STATUS_DISPATCHED, Run::STATUS_IN_PROGRESS], true),
            409, 'This run is completed or cancelled. Refresh the run.');
        return $run;
    }

    public function endpoints(Request $request, string $run_uuid, RunActionsService $actions)
    {
        $data = $request->validate($actions::endpointRules());
        return DB::transaction(fn () => ApiResponse::success($actions->endpoints($request, $this->editable($request, $run_uuid), $data)));
    }

    public function deliveryOrder(Request $request, string $run_uuid, RunActionsService $actions)
    {
        return DB::transaction(fn () => ApiResponse::success($actions->deliveryOrder($this->editable($request, $run_uuid))));
    }

    public function updateDeliveryOrder(Request $request, string $run_uuid, RunActionsService $actions)
    {
        $data = $request->validate($actions::orderRules());
        return DB::transaction(fn () => ApiResponse::success($actions->updateDeliveryOrder($request, $this->editable($request, $run_uuid), $data)));
    }
}
