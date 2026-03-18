<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTrackingProviderFormFieldRequest;
use App\Http\Requests\UpdateTrackingProviderFormFieldRequest;
use App\Http\Resources\TrackingProviderFormFieldResource;
use App\Services\TrackingProviderFormFieldService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AdminTrackingProviderFormFieldController extends Controller
{
    public function index(Request $request, string $provider_uuid, TrackingProviderFormFieldService $service)
    {
        try {
            $fields = $service->listFields($provider_uuid, $request->all());

            return ApiResponse::paginated($fields, TrackingProviderFormFieldResource::collection($fields));
        } catch (Throwable $e) {
            Log::error('Admin tracking provider form fields list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDER_FIELDS_FAILED', 'Unable to list tracking provider form fields.');
        }
    }

    public function show(string $provider_uuid, string $field_uuid, TrackingProviderFormFieldService $service)
    {
        try {
            $field = $service->getField($provider_uuid, $field_uuid);

            return ApiResponse::success(new TrackingProviderFormFieldResource($field));
        } catch (Throwable $e) {
            Log::error('Admin tracking provider form field fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDER_FIELD_NOT_FOUND', 'Tracking provider form field not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function store(StoreTrackingProviderFormFieldRequest $request, string $provider_uuid, TrackingProviderFormFieldService $service)
    {
        try {
            $field = $service->createField($provider_uuid, $request->validated());

            return ApiResponse::success(new TrackingProviderFormFieldResource($field), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Admin tracking provider form field create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDER_FIELD_CREATE_FAILED', 'Unable to create tracking provider form field.');
        }
    }

    public function update(UpdateTrackingProviderFormFieldRequest $request, string $provider_uuid, string $field_uuid, TrackingProviderFormFieldService $service)
    {
        try {
            $field = $service->updateField($provider_uuid, $field_uuid, $request->validated());

            return ApiResponse::success(new TrackingProviderFormFieldResource($field));
        } catch (Throwable $e) {
            Log::error('Admin tracking provider form field update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDER_FIELD_UPDATE_FAILED', 'Unable to update tracking provider form field.');
        }
    }

    public function destroy(string $provider_uuid, string $field_uuid, TrackingProviderFormFieldService $service)
    {
        try {
            $service->deleteField($provider_uuid, $field_uuid);

            return ApiResponse::success(['message' => 'Tracking provider form field deleted']);
        } catch (Throwable $e) {
            Log::error('Admin tracking provider form field delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_TRACKING_PROVIDER_FIELD_DELETE_FAILED', 'Unable to delete tracking provider form field.');
        }
    }
}
