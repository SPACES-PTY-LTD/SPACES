<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDriverVehicleRequest;
use App\Http\Requests\UpdateDriverVehicleRequest;
use App\Http\Resources\DriverVehicleResource;
use App\Models\Vehicle;
use App\Services\DriverVehicleService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class DriverVehicleController extends Controller
{
    public function index(Request $request, DriverVehicleService $service)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $vehicles = $service->listAssignments($request->all(), $driver->id);

            return ApiResponse::paginated($vehicles, DriverVehicleResource::collection($vehicles));
        } catch (Throwable $e) {
            Log::error('Driver vehicles list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_VEHICLES_FAILED', 'Unable to list vehicles.');
        }
    }

    public function show(Request $request, string $vehicle_uuid, DriverVehicleService $service)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $vehicle = $this->resolveVehicleForDriver($driver, $vehicle_uuid);
            $assignment = $service->getAssignment($driver, $vehicle);

            return ApiResponse::success(new DriverVehicleResource($assignment));
        } catch (Throwable $e) {
            Log::error('Driver vehicle fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_VEHICLE_NOT_FOUND', 'Vehicle not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function store(StoreDriverVehicleRequest $request, DriverVehicleService $service)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $vehicle = $this->resolveVehicleForDriver($driver, $request->validated()['vehicle_id']);
            $assignment = $service->assignVehicle($driver, $vehicle);

            return ApiResponse::success(new DriverVehicleResource($assignment), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Driver vehicle assign failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_VEHICLE_CREATE_FAILED', 'Unable to assign vehicle.'.$e->getMessage());
        }
    }

    public function update(UpdateDriverVehicleRequest $request, string $vehicle_uuid, DriverVehicleService $service)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $currentVehicle = $this->resolveVehicleForDriver($driver, $vehicle_uuid);
            $nextVehicle = $this->resolveVehicleForDriver($driver, $request->validated()['vehicle_id']);

            $assignment = $service->updateAssignment($driver, $currentVehicle, $nextVehicle);

            return ApiResponse::success(new DriverVehicleResource($assignment));
        } catch (Throwable $e) {
            Log::error('Driver vehicle update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_VEHICLE_UPDATE_FAILED', 'Unable to update vehicle.');
        }
    }

    public function destroy(Request $request, string $vehicle_uuid, DriverVehicleService $service)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $vehicle = $this->resolveVehicleForDriver($driver, $vehicle_uuid);
            $service->removeAssignment($driver, $vehicle);

            return ApiResponse::success(['message' => 'Vehicle unassigned']);
        } catch (Throwable $e) {
            Log::error('Driver vehicle delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_VEHICLE_DELETE_FAILED', 'Unable to unassign vehicle.');
        }
    }

    private function resolveVehicleForDriver($driver, string $vehicleUuid): Vehicle
    {
        $query = Vehicle::where('uuid', $vehicleUuid);
        if (!empty($driver->account_id)) {
            $query->where('account_id', $driver->account_id);
        }

        return $query->firstOrFail();
    }
}
