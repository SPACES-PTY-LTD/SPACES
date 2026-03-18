<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTrackingProviderOptionRequest;
use App\Http\Requests\UpdateTrackingProviderOptionRequest;
use App\Http\Resources\TrackingProviderOptionResource;
use App\Services\TrackingProviderOptionService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AdminTrackingProviderOptionController extends Controller
{
    public function index(Request $request, string $provider_uuid, TrackingProviderOptionService $service)
    {
        try {
            $options = $service->listOptions($provider_uuid, $request->all());

            return ApiResponse::paginated($options, TrackingProviderOptionResource::collection($options));
        } catch (Throwable $e) {
            Log::error('Admin tracking provider options list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDER_OPTIONS_FAILED', 'Unable to list tracking provider options.');
        }
    }

    public function show(string $provider_uuid, string $option_uuid, TrackingProviderOptionService $service)
    {
        try {
            $option = $service->getOption($provider_uuid, $option_uuid);

            return ApiResponse::success(new TrackingProviderOptionResource($option));
        } catch (Throwable $e) {
            Log::error('Admin tracking provider option fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDER_OPTION_NOT_FOUND', 'Tracking provider option not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function store(StoreTrackingProviderOptionRequest $request, string $provider_uuid, TrackingProviderOptionService $service)
    {
        try {
            $option = $service->createOption($provider_uuid, $request->validated());

            return ApiResponse::success(new TrackingProviderOptionResource($option), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Admin tracking provider option create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDER_OPTION_CREATE_FAILED', 'Unable to create tracking provider option.');
        }
    }

    public function update(UpdateTrackingProviderOptionRequest $request, string $provider_uuid, string $option_uuid, TrackingProviderOptionService $service)
    {
        try {
            $option = $service->updateOption($provider_uuid, $option_uuid, $request->validated());

            return ApiResponse::success(new TrackingProviderOptionResource($option));
        } catch (Throwable $e) {
            Log::error('Admin tracking provider option update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDER_OPTION_UPDATE_FAILED', 'Unable to update tracking provider option.');
        }
    }

    public function destroy(string $provider_uuid, string $option_uuid, TrackingProviderOptionService $service)
    {
        try {
            $service->deleteOption($provider_uuid, $option_uuid);

            return ApiResponse::success(['message' => 'Tracking provider option deleted']);
        } catch (Throwable $e) {
            Log::error('Admin tracking provider option delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDER_OPTION_DELETE_FAILED', 'Unable to delete tracking provider option.');
        }
    }
}
