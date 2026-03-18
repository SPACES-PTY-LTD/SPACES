<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\DriverHeartbeatRequest;
use App\Http\Resources\DriverPresenceResource;
use App\Services\DriverPresenceService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class DriverPresenceController extends Controller
{
    public function heartbeat(DriverHeartbeatRequest $request, DriverPresenceService $driverPresenceService)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $presence = $driverPresenceService->heartbeat($driver, $request->validated());

            return ApiResponse::success(new DriverPresenceResource($presence));
        } catch (Throwable $e) {
            Log::error('Driver heartbeat failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_HEARTBEAT_FAILED', 'Unable to update driver presence.');
        }
    }

    public function status(Request $request, DriverPresenceService $driverPresenceService)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $isOnline = filter_var($request->input('is_online'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($isOnline === null) {
                return ApiResponse::error('VALIDATION', 'The is_online field is required.', [], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $presence = $driverPresenceService->setOnlineStatus($driver, $isOnline);

            return ApiResponse::success(new DriverPresenceResource($presence));
        } catch (Throwable $e) {
            Log::error('Driver online status update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_STATUS_FAILED', 'Unable to update online status.');
        }
    }
}
