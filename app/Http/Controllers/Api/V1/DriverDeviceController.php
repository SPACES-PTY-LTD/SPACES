<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterUserDeviceRequest;
use App\Services\UserDeviceService;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class DriverDeviceController extends Controller
{
    public function store(RegisterUserDeviceRequest $request, UserDeviceService $userDeviceService)
    {
        try {
            $device = $userDeviceService->register($request->user(), $request->validated());

            return ApiResponse::success([
                'user_device_id' => $device->uuid,
                'platform' => $device->platform,
                'push_provider' => $device->push_provider,
                'push_token' => $device->push_token,
                'last_seen_at' => optional($device->last_seen_at)?->toIso8601String(),
            ], [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Driver device registration failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_DEVICE_REGISTER_FAILED', 'Unable to register driver device.');
        }
    }
}
