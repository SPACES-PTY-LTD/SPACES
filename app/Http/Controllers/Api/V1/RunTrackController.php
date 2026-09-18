<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Run;
use App\Services\RunTrackService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class RunTrackController extends Controller
{
    public function show(Request $request, string $run_uuid, RunTrackService $service)
    {
        $request->validate(['before' => 'nullable|string|max:256']);
        $query = Run::where('uuid', $run_uuid);
        if ($environment = $request->attributes->get('merchant_environment')) {
            $query->where('merchant_id', $environment->merchant_id)->where('environment_id', $environment->id);
        }
        $run = $query->firstOrFail();
        $this->authorize('view', $run);

        return ApiResponse::success($service->get($run, $request->query('before')));
    }

    public function driver(Request $request, string $run_uuid, RunTrackService $service)
    {
        $request->validate(['before' => 'nullable|string|max:256']);
        $driver = $request->user()->driver;
        abort_unless($driver, 403);
        $run = $driver->runs()->where('uuid', $run_uuid)->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)->firstOrFail();

        return ApiResponse::success($service->get($run, $request->query('before')));
    }
}
