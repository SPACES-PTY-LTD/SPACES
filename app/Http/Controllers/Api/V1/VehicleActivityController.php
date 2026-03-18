<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListVehicleLatestActivityCheckRequest;
use App\Http\Requests\ListVehicleActivitiesRequest;
use App\Http\Resources\VehicleLatestActivityCheckResource;
use App\Http\Resources\VehicleActivityResource;
use App\Services\VehicleActivityService;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class VehicleActivityController extends Controller
{
    public function index(ListVehicleActivitiesRequest $request, VehicleActivityService $service)
    {
        try {
            $activities = $service->listActivities($request->user(), $request->validated());

            return ApiResponse::paginated($activities, VehicleActivityResource::collection($activities));
        } catch (Throwable $e) {
            Log::error('Vehicle activities list failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'VEHICLE_ACTIVITIES_FAILED', 'Unable to list vehicle activities.');
        }
    }

    public function latestActivityCheck(ListVehicleLatestActivityCheckRequest $request, VehicleActivityService $service)
    {
        try {
            $vehicles = $service->listVehiclesWithLatestActivity($request->user(), $request->validated());

            return ApiResponse::success(VehicleLatestActivityCheckResource::collection($vehicles));
        } catch (Throwable $e) {
            Log::error('Vehicle latest activity check failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'VEHICLE_LATEST_ACTIVITY_CHECK_FAILED', 'Unable to list vehicle latest activity check.');
        }
    }

    public function show(string $activity_uuid, VehicleActivityService $service)
    {
        try {
            $activity = $service->getActivity(request()->user(), $activity_uuid);

            return ApiResponse::success(new VehicleActivityResource($activity));
        } catch (Throwable $e) {
            Log::error('Vehicle activity fetch failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'VEHICLE_ACTIVITY_NOT_FOUND', 'Vehicle activity not found.', Response::HTTP_NOT_FOUND);
        }
    }
}
