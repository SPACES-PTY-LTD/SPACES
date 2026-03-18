<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ImportLocationsRequest;
use App\Http\Requests\ListLocationsRequest;
use App\Http\Requests\StoreLocationRequest;
use App\Http\Requests\UpdateLocationRequest;
use App\Http\Resources\LocationResource;
use App\Services\LocationService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class LocationController extends Controller
{
    public function index(ListLocationsRequest $request, LocationService $service)
    {
        try {
            $locations = $service->listLocations($request->user(), $request->validated());

            return ApiResponse::paginated($locations, LocationResource::collection($locations));
        } catch (Throwable $e) {
            Log::error('Location list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'LOCATIONS_FAILED', 'Unable to list locations.');
        }
    }

    public function show(Request $request, string $location_uuid, LocationService $service)
    {
        try {
            $location = $service->getLocation($request->user(), $location_uuid);

            return ApiResponse::success(new LocationResource($location));
        } catch (Throwable $e) {
            Log::error('Location fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'LOCATION_NOT_FOUND', 'Location not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function store(StoreLocationRequest $request, LocationService $service)
    {
        try {
            $location = $service->createLocation($request->user(), $request->validated());

            return ApiResponse::success(new LocationResource($location), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Location create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'LOCATION_CREATE_FAILED', 'Unable to create location.');
        }
    }

    public function update(UpdateLocationRequest $request, string $location_uuid, LocationService $service)
    {
        try {
            $location = $service->updateLocation($request->user(), $location_uuid, $request->validated());

            return ApiResponse::success(new LocationResource($location));
        } catch (Throwable $e) {
            Log::error('Location update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'LOCATION_UPDATE_FAILED', 'Unable to update location.');
        }
    }

    public function destroy(Request $request, string $location_uuid, LocationService $service)
    {
        try {
            $service->deleteLocation($request->user(), $location_uuid);

            return ApiResponse::success(['message' => 'Location deleted']);
        } catch (Throwable $e) {
            Log::error('Location delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'LOCATION_DELETE_FAILED', 'Unable to delete location.');
        }
    }

    public function import(ImportLocationsRequest $request, LocationService $service)
    {
        try {
            $result = $service->importLocations($request->user(), $request->validated());

            return ApiResponse::success($result);
        } catch (Throwable $e) {
            Log::error('Location import failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'LOCATION_IMPORT_FAILED', 'Unable to import locations.');
        }
    }
}
