<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ImportVehiclesRequest;
use App\Http\Requests\StoreVehicleRequest;
use App\Http\Requests\SyncTagsRequest;
use App\Http\Requests\UpdateVehicleMaintenanceRequest;
use App\Http\Requests\UpdateVehicleRequest;
use App\Http\Resources\VehicleResource;
use App\Services\VehicleService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class VehicleController extends Controller
{
    public function index(Request $request, VehicleService $service)
    {
        try {
            $vehicles = $service->listVehicles($request->user(), $request->all());
            return ApiResponse::paginated($vehicles, VehicleResource::collection($vehicles));
        } catch (Throwable $e) {
            Log::error('Vehicle list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'VEHICLES_FAILED', 'Unable to list vehicles.');
        }
    }

    public function show(Request $request, string $vehicle_uuid, VehicleService $service)
    {
        try {
            $vehicle = $service->getVehicle($request->user(), $vehicle_uuid, $request->all());

            return ApiResponse::success(new VehicleResource($vehicle));
        } catch (Throwable $e) {
            Log::error('Vehicle fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'VEHICLE_NOT_FOUND', 'Vehicle not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function store(StoreVehicleRequest $request, VehicleService $service)
    {
        try {
            $vehicle = $service->createVehicle($request->user(), $request->validated());

            return ApiResponse::success(new VehicleResource($vehicle), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Vehicle create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'VEHICLE_CREATE_FAILED', 'Unable to create vehicle.');
        }
    }

    public function update(UpdateVehicleRequest $request, string $vehicle_uuid, VehicleService $service)
    {
        try {
            $vehicle = $service->updateVehicle($request->user(), $vehicle_uuid, $request->validated());

            return ApiResponse::success(new VehicleResource($vehicle));
        } catch (Throwable $e) {
            Log::error('Vehicle update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'VEHICLE_UPDATE_FAILED', 'Unable to update vehicle.');
        }
    }

    public function destroy(Request $request, string $vehicle_uuid, VehicleService $service)
    {
        try {
            $service->deleteVehicle($request->user(), $vehicle_uuid);

            return ApiResponse::success(['message' => 'Vehicle deleted']);
        } catch (Throwable $e) {
            Log::error('Vehicle delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'VEHICLE_DELETE_FAILED', 'Unable to delete vehicle.');
        }
    }

    public function updateMaintenance(UpdateVehicleMaintenanceRequest $request, string $vehicle_uuid, VehicleService $service)
    {
        try {
            $vehicle = $service->updateMaintenanceMode($request->user(), $vehicle_uuid, $request->validated());

            return ApiResponse::success(new VehicleResource($vehicle));
        } catch (Throwable $e) {
            Log::error('Vehicle maintenance update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'VEHICLE_MAINTENANCE_UPDATE_FAILED', 'Unable to update vehicle maintenance.');
        }
    }

    public function syncTags(SyncTagsRequest $request, string $vehicle_uuid, VehicleService $service)
    {
        try {
            $vehicle = $service->syncTags($request->user(), $vehicle_uuid, $request->validated('tags'));

            return ApiResponse::success(new VehicleResource($vehicle));
        } catch (Throwable $e) {
            Log::error('Vehicle tags update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'VEHICLE_TAGS_UPDATE_FAILED', 'Unable to update vehicle tags.');
        }
    }

    public function import(ImportVehiclesRequest $request, VehicleService $service)
    {
        try {
            $result = $service->importVehicles($request->user(), $request->validated());

            return ApiResponse::success($result);
        } catch (Throwable $e) {
            Log::error('Vehicle import failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'VEHICLE_IMPORT_FAILED', 'Unable to import vehicles.');
        }
    }
}
