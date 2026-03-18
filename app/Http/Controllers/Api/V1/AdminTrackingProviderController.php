<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTrackingProviderRequest;
use App\Http\Requests\UpdateTrackingProviderRequest;
use App\Http\Resources\TrackingProviderResource;
use App\Services\TrackingProviderService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AdminTrackingProviderController extends Controller
{
    public function index(Request $request, TrackingProviderService $service)
    {
        try {
            $providers = $service->listProviders($request->all());

            return ApiResponse::paginated($providers, TrackingProviderResource::collection($providers));
        } catch (Throwable $e) {
            Log::error('Admin tracking providers list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDERS_FAILED', 'Unable to list tracking providers.');
        }
    }

    public function show(string $provider_uuid, TrackingProviderService $service)
    {
        try {
            $merchantUuid = request()->get('merchant_id');
            $provider = $service->getProvider($provider_uuid, $merchantUuid);

            return ApiResponse::success(new TrackingProviderResource($provider));
        } catch (Throwable $e) {
            Log::error('Admin tracking provider fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDER_NOT_FOUND', 'Tracking provider not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function store(StoreTrackingProviderRequest $request, TrackingProviderService $service)
    {
        try {
            $provider = $service->createProvider($request->validated());

            return ApiResponse::success(new TrackingProviderResource($provider), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Admin tracking provider create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDER_CREATE_FAILED', 'Unable to create tracking provider.');
        }
    }

    public function update(UpdateTrackingProviderRequest $request, string $provider_uuid, TrackingProviderService $service)
    {
        try {
            $provider = $service->updateProvider($provider_uuid, $request->validated());

            return ApiResponse::success(new TrackingProviderResource($provider));
        } catch (Throwable $e) {
            Log::error('Admin tracking provider update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDER_UPDATE_FAILED', 'Unable to update tracking provider.');
        }
    }

    public function destroy(string $provider_uuid, TrackingProviderService $service)
    {
        try {
            $service->deleteProvider($provider_uuid);

            return ApiResponse::success(['message' => 'Tracking provider deleted']);
        } catch (Throwable $e) {
            Log::error('Admin tracking provider delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDER_DELETE_FAILED', 'Unable to delete tracking provider.');
        }
    }
}
