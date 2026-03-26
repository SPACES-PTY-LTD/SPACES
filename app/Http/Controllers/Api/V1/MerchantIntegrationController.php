<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ActivateTrackingProviderRequest;
use App\Http\Requests\GetTrackingProviderImportStatusesRequest;
use App\Http\Requests\ImportTrackingProviderDriversRequest;
use App\Http\Requests\ImportTrackingProviderLocationsRequest;
use App\Http\Requests\ImportTrackingProviderVehiclesRequest;
use App\Http\Requests\ListTrackingProviderVehiclesRequest;
use App\Http\Requests\UpdateTrackingProviderOptionsDataRequest;
use App\Http\Resources\TrackingProviderResource;
use App\Http\Resources\TrackingProviderVehicleResource;
use App\Services\MerchantIntegrationService;
use App\Services\TrackingProviderService;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class MerchantIntegrationController extends Controller
{
    public function activateTrackingProvider(
        ActivateTrackingProviderRequest $request,
        MerchantIntegrationService $service,
        TrackingProviderService $providerService
    ) {
        try {
            $data = $request->validated();
            $integration = $service->activateProvider(
                $request->user(),
                $data['provider_id'],
                $data['integration_data'],
                $data['merchant_id'] ?? null
            );

            $integration->load('merchant');
            $provider = $providerService->getProvider($data['provider_id'], $integration->merchant?->uuid);

            return ApiResponse::success([
                'integration_id' => $integration->uuid,
                'provider' => new TrackingProviderResource($provider),
            ], [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Activate tracking provider failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'TRACKING_PROVIDER_ACTIVATION_FAILED', 'Unable to activate tracking provider.');
        }
    }

    public function updateTrackingProviderOptionsData(
        UpdateTrackingProviderOptionsDataRequest $request,
        string $provider_id,
        MerchantIntegrationService $service,
        TrackingProviderService $providerService
    ) {
        try {
            $data = $request->validated();
            $integration = $service->updateProviderOptionsData(
                $request->user(),
                $provider_id,
                $data['merchant_id'],
                $data['integration_options_data']
            );

            $integration->load('merchant');
            $provider = $providerService->getProvider($provider_id, $integration->merchant?->uuid);

            return ApiResponse::success([
                'integration_id' => $integration->uuid,
                'provider' => new TrackingProviderResource($provider),
            ]);
        } catch (Throwable $e) {
            Log::error('Update tracking provider options data failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'TRACKING_PROVIDER_OPTIONS_DATA_UPDATE_FAILED', 'Unable to update tracking provider options data.');
        }
    }

    public function importTrackingProviderVehicles(
        ImportTrackingProviderVehiclesRequest $request,
        string $provider_id,
        MerchantIntegrationService $service
    ) {
        try {
            $result = $service->queueProviderVehiclesImport(
                $request->user(),
                $provider_id,
                $request->validated()['merchant_id'],
                $request->validated()['vehicle_ids']
            );

            return ApiResponse::success([
                'queued' => $result['queued'],
                'already_in_progress' => $result['already_in_progress'],
                'imports_stats' => $result['stats'],
            ], [], Response::HTTP_ACCEPTED);
        } catch (Throwable $e) {
            Log::error('Import tracking provider vehicles failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'TRACKING_PROVIDER_IMPORT_VEHICLES_FAILED', $e->getMessage());
        }
    }

    public function listTrackingProviderVehicles(
        ListTrackingProviderVehiclesRequest $request,
        string $provider_id,
        MerchantIntegrationService $service
    ) {
        try {
            $vehicles = $service->listProviderVehicles(
                $request->user(),
                $provider_id,
                $request->validated()['merchant_id']
            );

            return ApiResponse::success(TrackingProviderVehicleResource::collection(collect($vehicles)));
        } catch (Throwable $e) {
            Log::error('List tracking provider vehicles failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'TRACKING_PROVIDER_LIST_VEHICLES_FAILED', $e->getMessage());
        }
    }

    public function importTrackingProviderDrivers(
        ImportTrackingProviderDriversRequest $request,
        string $provider_id,
        MerchantIntegrationService $service
    ) {
        try {
            $result = $service->queueProviderDriversImport(
                $request->user(),
                $provider_id,
                $request->validated()['merchant_id']
            );

            return ApiResponse::success([
                'queued' => $result['queued'],
                'already_in_progress' => $result['already_in_progress'],
                'imports_stats' => $result['stats'],
            ], [], Response::HTTP_ACCEPTED);
        } catch (Throwable $e) {
            Log::error('Import tracking provider drivers failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'TRACKING_PROVIDER_IMPORT_DRIVERS_FAILED', $e->getMessage());
        }
    }

    public function importTrackingProviderLocations(
        ImportTrackingProviderLocationsRequest $request,
        string $provider_id,
        MerchantIntegrationService $service
    ) {
        try {
            $validated = $request->validated();
            $result = $service->queueProviderLocationsImport(
                $request->user(),
                $provider_id,
                $validated['merchant_id'],
                $validated['only_with_geofences'] ?? null
            );

            return ApiResponse::success([
                'queued' => $result['queued'],
                'already_in_progress' => $result['already_in_progress'],
                'imports_stats' => $result['stats'],
            ], [], Response::HTTP_ACCEPTED);
        } catch (Throwable $e) {
            Log::error('Import tracking provider locations failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'TRACKING_PROVIDER_IMPORT_LOCATIONS_FAILED', $e->getMessage());
        }
    }

    public function importStatuses(
        GetTrackingProviderImportStatusesRequest $request,
        MerchantIntegrationService $service
    ) {
        try {
            $statuses = $service->getImportStatuses(
                $request->user(),
                $request->validated()['merchant_id']
            );

            return ApiResponse::success($statuses);
        } catch (Throwable $e) {
            Log::error('Fetch tracking provider import statuses failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'TRACKING_PROVIDER_IMPORT_STATUSES_FAILED', $e->getMessage());
        }
    }
}
