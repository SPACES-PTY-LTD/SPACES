<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SyncLocationTypesRequest;
use App\Http\Resources\LocationTypeResource;
use App\Services\LocationTypeService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class LocationTypeController extends Controller
{
    public function index(Request $request, LocationTypeService $service)
    {
        try {
            $merchantUuid = $request->input('merchant_id') ?? $request->input('merchant_uuid');
            if (!$merchantUuid) {
                return ApiResponse::error('VALIDATION', 'The merchant_id field is required.', [], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $result = $service->listByMerchant($request->user(), $merchantUuid, $request->all());

            return ApiResponse::success(
                LocationTypeResource::collection($result['types']),
                ['is_default_fallback' => (bool) $result['is_default_fallback']]
            );
        } catch (Throwable $e) {
            Log::error('Location types list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'LOCATION_TYPES_FAILED', 'Unable to list location types.');
        }
    }

    public function update(SyncLocationTypesRequest $request, LocationTypeService $service)
    {
        try {
            $types = $service->syncByMerchant(
                $request->user(),
                $request->validated('merchant_id'),
                $request->validated('types')
            );

            return ApiResponse::success(LocationTypeResource::collection($types));
        } catch (Throwable $e) {
            Log::error('Location types sync failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'LOCATION_TYPES_SYNC_FAILED', 'Unable to sync location types.');
        }
    }
}
