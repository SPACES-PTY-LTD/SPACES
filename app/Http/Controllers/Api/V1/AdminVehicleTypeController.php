<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreVehicleTypeRequest;
use App\Http\Requests\UpdateVehicleTypeRequest;
use App\Http\Resources\VehicleTypeResource;
use App\Models\VehicleType;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AdminVehicleTypeController extends Controller
{
    public function index(Request $request)
    {
        try {
            $perPage = min((int) $request->get('per_page', 15), 100);
            $query = VehicleType::query()->orderByDesc('created_at');

            if ($request->has('enabled')) {
                $query->where('enabled', (bool) $request->get('enabled'));
            }

            $types = $query->paginate($perPage);

            return ApiResponse::paginated($types, VehicleTypeResource::collection($types));
        } catch (Throwable $e) {
            Log::error('Admin vehicle types list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_VEHICLE_TYPES_FAILED', 'Unable to list vehicle types.');
        }
    }

    public function show(string $vehicle_type_uuid)
    {
        try {
            $type = VehicleType::where('uuid', $vehicle_type_uuid)->firstOrFail();

            return ApiResponse::success(new VehicleTypeResource($type));
        } catch (Throwable $e) {
            Log::error('Admin vehicle type fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_VEHICLE_TYPE_NOT_FOUND', 'Vehicle type not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function store(StoreVehicleTypeRequest $request)
    {
        try {
            $type = VehicleType::create($request->validated());

            return ApiResponse::success(new VehicleTypeResource($type), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Admin vehicle type create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_VEHICLE_TYPE_CREATE_FAILED', 'Unable to create vehicle type.');
        }
    }

    public function update(UpdateVehicleTypeRequest $request, string $vehicle_type_uuid)
    {
        try {
            $type = VehicleType::where('uuid', $vehicle_type_uuid)->firstOrFail();
            $type->update($request->validated());

            return ApiResponse::success(new VehicleTypeResource($type));
        } catch (Throwable $e) {
            Log::error('Admin vehicle type update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_VEHICLE_TYPE_UPDATE_FAILED', 'Unable to update vehicle type.');
        }
    }

    public function destroy(string $vehicle_type_uuid)
    {
        try {
            $type = VehicleType::where('uuid', $vehicle_type_uuid)->firstOrFail();
            $type->delete();

            return ApiResponse::success(['message' => 'Vehicle type deleted']);
        } catch (Throwable $e) {
            Log::error('Admin vehicle type delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_VEHICLE_TYPE_DELETE_FAILED', 'Unable to delete vehicle type.');
        }
    }
}
