<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMerchantRequest;
use App\Http\Requests\UploadMerchantLogoRequest;
use App\Http\Requests\UpdateMerchantRequest;
use App\Http\Requests\UpdateMerchantLocationAutomationRequest;
use App\Http\Requests\UpdateMerchantSettingsRequest;
use App\Http\Resources\MerchantLocationAutomationResource;
use App\Http\Resources\MerchantResource;
use App\Models\Merchant;
use App\Services\MerchantService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class MerchantController extends Controller
{
    public function index(Request $request, MerchantService $service)
    {
        try {
            $this->authorize('viewAny', Merchant::class);

            $merchants = $service->listMerchants($request->user(), $request->all());

            return ApiResponse::paginated($merchants, MerchantResource::collection($merchants));
        } catch (Throwable $e) {
            Log::error('Merchants list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_LIST_FAILED', 'Unable to list merchants.');
        }
    }

    public function store(StoreMerchantRequest $request, MerchantService $service)
    {
        try {
            $this->authorize('create', Merchant::class);

            $merchant = $service->createMerchant($request->user(), $request->validated());

            return ApiResponse::success(new MerchantResource($merchant->load('owner')), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Merchant create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_CREATE_FAILED', 'Unable to create merchant.');
        }
    }

    public function show(string $merchant_uuid)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('view', $merchant);

            return ApiResponse::success(new MerchantResource($merchant->load('owner')));
        } catch (Throwable $e) {
            Log::error('Merchant fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_NOT_FOUND', 'Merchant not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function update(UpdateMerchantRequest $request, string $merchant_uuid, MerchantService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('update', $merchant);

            $merchant = $service->updateMerchant($merchant, $request->validated());

            return ApiResponse::success(new MerchantResource($merchant->load('owner')));
        } catch (Throwable $e) {
            Log::error('Merchant update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_UPDATE_FAILED', 'Unable to update merchant.');
        }
    }

    public function destroy(string $merchant_uuid, MerchantService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('delete', $merchant);

            $service->deleteMerchant($merchant);

            return ApiResponse::success(['message' => 'Merchant deleted']);
        } catch (Throwable $e) {
            Log::error('Merchant delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_DELETE_FAILED', 'Unable to delete merchant.');
        }
    }

    public function updateSettings(UpdateMerchantSettingsRequest $request, string $merchant_uuid, MerchantService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('update', $merchant);

            $merchant = $service->updateMerchantSettings($merchant, $request->validated());

            return ApiResponse::success(new MerchantResource($merchant->load('owner')));
        } catch (Throwable $e) {
            Log::error('Merchant settings update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_SETTINGS_UPDATE_FAILED', 'Unable to update merchant settings.');
        }
    }

    public function updateLogo(UploadMerchantLogoRequest $request, string $merchant_uuid, MerchantService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('update', $merchant);

            $merchant = $service->updateMerchantLogo($merchant, $request->file('logo'));

            return ApiResponse::success(new MerchantResource($merchant->load('owner')));
        } catch (Throwable $e) {
            Log::error('Merchant logo update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_LOGO_UPDATE_FAILED', 'Unable to update merchant logo.');
        }
    }

    public function showLocationAutomation(string $merchant_uuid, MerchantService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('view', $merchant);

            $merchant = $service->getMerchantLocationAutomation($merchant);

            return ApiResponse::success(new MerchantLocationAutomationResource($merchant));
        } catch (Throwable $e) {
            Log::error('Merchant location automation fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_LOCATION_AUTOMATION_FETCH_FAILED', 'Unable to fetch merchant location automation.');
        }
    }

    public function updateLocationAutomation(UpdateMerchantLocationAutomationRequest $request, string $merchant_uuid, MerchantService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('update', $merchant);

            $merchant = $service->updateMerchantLocationAutomation($merchant, $request->validated());

            return ApiResponse::success(new MerchantLocationAutomationResource($merchant));
        } catch (Throwable $e) {
            Log::error('Merchant location automation update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_LOCATION_AUTOMATION_UPDATE_FAILED', 'Unable to update merchant location automation.');
        }
    }
}
