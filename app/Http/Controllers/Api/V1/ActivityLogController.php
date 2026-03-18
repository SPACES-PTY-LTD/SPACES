<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListActivityLogsRequest;
use App\Http\Resources\ActivityLogResource;
use App\Services\ActivityLogService;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class ActivityLogController extends Controller
{
    public function index(ListActivityLogsRequest $request, ActivityLogService $service)
    {
        try {
            $activities = $service->listActivities($request->user(), $request->validated());

            return ApiResponse::paginated($activities, ActivityLogResource::collection($activities));
        } catch (Throwable $e) {
            Log::error('Activity logs list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ACTIVITY_LOGS_FAILED', 'Unable to list activity logs.');
        }
    }

    public function show(string $log_id, ActivityLogService $service)
    {
        try {
            $activity = $service->getActivity(request()->user(), $log_id);

            return ApiResponse::success(new ActivityLogResource($activity));
        } catch (Throwable $e) {
            Log::error('Activity log fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ACTIVITY_LOG_NOT_FOUND', 'Activity log not found.', Response::HTTP_NOT_FOUND);
        }
    }
}
