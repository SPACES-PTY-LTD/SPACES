<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ActivateTrackingProviderRequest;
use App\Http\Requests\GetTrackingProviderImportStatusesRequest;
use App\Http\Requests\ImportTrackingProviderDriversRequest;
use App\Http\Requests\ImportTrackingProviderLocationsRequest;
use App\Http\Requests\ImportTrackingProviderVehiclesRequest;
use App\Http\Requests\InspectTrackingProviderMixTokenRequest;
use App\Http\Requests\ListPowerfleetOrganisationRequest;
use App\Http\Requests\ListTrackingProviderDriversRequest;
use App\Http\Requests\ListTrackingProviderLocationsRequest;
use App\Http\Requests\ListTrackingProviderVehiclesRequest;
use App\Http\Requests\UpdateTrackingProviderOptionsDataRequest;
use App\Http\Resources\TrackingProviderDriverResource;
use App\Http\Resources\TrackingProviderLocationResource;
use App\Http\Resources\TrackingProviderResource;
use App\Http\Resources\TrackingProviderVehicleResource;
use App\Services\MerchantIntegrationService;
use App\Services\TrackingProviderService;
use App\Support\ApiResponse;
use Illuminate\Http\Client\RequestException;
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
                $request->validated()['vehicles']
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

    public function listTrackingProviderDrivers(
        ListTrackingProviderDriversRequest $request,
        string $provider_id,
        MerchantIntegrationService $service
    ) {
        try {
            $drivers = $service->listProviderDrivers(
                $request->user(),
                $provider_id,
                $request->validated()['merchant_id']
            );

            return ApiResponse::success(TrackingProviderDriverResource::collection(collect($drivers)));
        } catch (Throwable $e) {
            Log::error('List tracking provider drivers failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'TRACKING_PROVIDER_LIST_DRIVERS_FAILED', $e->getMessage());
        }
    }

    public function listTrackingProviderLocations(
        ListTrackingProviderLocationsRequest $request,
        string $provider_id,
        MerchantIntegrationService $service
    ) {
        try {
            $locations = $service->listProviderLocations(
                $request->user(),
                $provider_id,
                $request->validated()['merchant_id']
            );

            return ApiResponse::success(TrackingProviderLocationResource::collection(collect($locations)));
        } catch (Throwable $e) {
            Log::error('List tracking provider locations failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'TRACKING_PROVIDER_LIST_LOCATIONS_FAILED', $e->getMessage());
        }
    }

    public function importTrackingProviderDrivers(
        ImportTrackingProviderDriversRequest $request,
        string $provider_id,
        MerchantIntegrationService $service
    ) {
        try {
            $validated = $request->validated();
            $result = $service->queueProviderDriversImport(
                $request->user(),
                $provider_id,
                $validated['merchant_id'],
                $validated['drivers'] ?? []
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
                $validated['only_with_geofences'] ?? null,
                $validated['locations'] ?? []
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

    public function inspectMixToken(
        InspectTrackingProviderMixTokenRequest $request,
        string $provider_id,
        MerchantIntegrationService $service
    ) {
        try {
            $analysis = $service->inspectMixToken(
                $request->user(),
                $provider_id,
                $request->validated()['merchant_id']
            );

            return ApiResponse::success($analysis);
        } catch (Throwable $e) {
            Log::error('Inspect Mix token failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'TRACKING_PROVIDER_MIX_TOKEN_ANALYSIS_FAILED', $e->getMessage());
        }
    }

    public function listPowerfleetOrganisations(
        ListPowerfleetOrganisationRequest $request,
        string $provider_id,
        MerchantIntegrationService $service
    ) {
        try {
            $organisations = $service->listPowerfleetOrganisations(
                $request->user(),
                $provider_id,
                $request->validated()['merchant_id']
            );

            return ApiResponse::success($organisations);
        } catch (Throwable $e) {
            $errorMessage = $this->externalHttpExceptionMessage($e);

            Log::error('List Powerfleet organisations failed', array_merge([
                'request_id' => ApiResponse::requestId(),
                'error' => $errorMessage,
            ], $this->externalHttpExceptionContext($e)));

            return $this->apiError($e, 'TRACKING_PROVIDER_POWERFLEET_ORGANISATIONS_FAILED', $errorMessage);
        }
    }

    public function listPowerfleetSubgroups(
        ListPowerfleetOrganisationRequest $request,
        string $provider_id,
        string $group_id,
        MerchantIntegrationService $service
    ) {
        try {
            $subgroups = $service->listPowerfleetSubgroups(
                $request->user(),
                $provider_id,
                $request->validated()['merchant_id'],
                $group_id
            );

            return ApiResponse::success($subgroups);
        } catch (Throwable $e) {
            $errorMessage = $this->externalHttpExceptionMessage($e);

            Log::error('List Powerfleet subgroups failed', array_merge([
                'request_id' => ApiResponse::requestId(),
                'error' => $errorMessage,
            ], $this->externalHttpExceptionContext($e)));

            return $this->apiError($e, 'TRACKING_PROVIDER_POWERFLEET_SUBGROUPS_FAILED', $errorMessage);
        }
    }

    public function showPowerfleetOrganisationDetails(
        ListPowerfleetOrganisationRequest $request,
        string $provider_id,
        string $group_id,
        MerchantIntegrationService $service
    ) {
        try {
            $details = $service->getPowerfleetOrganisationDetails(
                $request->user(),
                $provider_id,
                $request->validated()['merchant_id'],
                $group_id
            );

            return ApiResponse::success($details);
        } catch (Throwable $e) {
            $errorMessage = $this->externalHttpExceptionMessage($e);

            Log::error('Show Powerfleet organisation details failed', array_merge([
                'request_id' => ApiResponse::requestId(),
                'error' => $errorMessage,
            ], $this->externalHttpExceptionContext($e)));

            return $this->apiError($e, 'TRACKING_PROVIDER_POWERFLEET_ORGANISATION_DETAILS_FAILED', $errorMessage);
        }
    }

    private function externalHttpExceptionMessage(Throwable $exception): string
    {
        $message = trim($exception->getMessage());

        if ($exception instanceof RequestException) {
            $body = trim($exception->response->body());

            if ($body !== '' && ($message === '' || $this->hasEmptyProviderMessage($body))) {
                return $body;
            }
        }

        return $message !== '' ? $message : $exception::class;
    }

    private function externalHttpExceptionContext(Throwable $exception): array
    {
        if (!$exception instanceof RequestException) {
            return [];
        }

        return [
            'response_status' => $exception->response->status(),
            'response_body' => $exception->response->body(),
        ];
    }

    private function hasEmptyProviderMessage(string $body): bool
    {
        $decoded = json_decode($body, true);

        if (!is_array($decoded) || !array_key_exists('Message', $decoded)) {
            return false;
        }

        $message = $decoded['Message'];

        return $message === null
            || $message === ''
            || $message === [];
    }
}
