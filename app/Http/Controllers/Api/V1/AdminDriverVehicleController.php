<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDriverVehicleRequest;
use App\Http\Requests\UpdateDriverVehicleRequest;
use App\Http\Resources\DriverVehicleResource;
use App\Models\Carrier;
use App\Models\Driver;
use App\Models\Merchant;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\DriverVehicleService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AdminDriverVehicleController extends Controller
{
    public function index(Request $request, string $driver_uuid, DriverVehicleService $service)
    {
        try {
            $driver = $this->resolveDriver($request, $driver_uuid);
            $carrierId = null;
            if ($this->isMerchant($request)) {
                $carrierId = $this->merchantCarrierId($request) ?? -1;
            }

            $vehicles = $service->listAssignments($request->all(), $driver->id, $carrierId);

            return ApiResponse::paginated($vehicles, DriverVehicleResource::collection($vehicles));
        } catch (Throwable $e) {
            Log::error('Admin driver vehicles list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_DRIVER_VEHICLES_FAILED', 'Unable to list vehicles.');
        }
    }

    public function store(StoreDriverVehicleRequest $request, string $driver_uuid, DriverVehicleService $service)
    {
        try {
            $driver = $this->resolveDriver($request, $driver_uuid);
            $vehicle = $this->resolveVehicleForUser($request->user(), $request->validated()['vehicle_id']);

            $assignment = $service->assignVehicle($driver, $vehicle);

            return ApiResponse::success(new DriverVehicleResource($assignment), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Admin driver vehicle assign failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_DRIVER_VEHICLE_CREATE_FAILED', 'Unable to assign vehicle.'.$e->getMessage());
        }
    }

    public function update(UpdateDriverVehicleRequest $request, string $driver_uuid, string $vehicle_uuid, DriverVehicleService $service)
    {
        try {
            $driver = $this->resolveDriver($request, $driver_uuid);
            $currentVehicle = $this->resolveVehicleForUser($request->user(), $vehicle_uuid);
            $nextVehicle = $this->resolveVehicleForUser($request->user(), $request->validated()['vehicle_id']);

            $assignment = $service->updateAssignment($driver, $currentVehicle, $nextVehicle);

            return ApiResponse::success(new DriverVehicleResource($assignment));
        } catch (Throwable $e) {
            Log::error('Admin driver vehicle update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_DRIVER_VEHICLE_UPDATE_FAILED', 'Unable to update vehicle.');
        }
    }

    public function destroy(Request $request, string $driver_uuid, string $vehicle_uuid, DriverVehicleService $service)
    {
        try {
            $driver = $this->resolveDriver($request, $driver_uuid);
            $vehicle = $this->resolveVehicleForUser($request->user(), $vehicle_uuid);

            $service->removeAssignment($driver, $vehicle);

            return ApiResponse::success(['message' => 'Vehicle unassigned']);
        } catch (Throwable $e) {
            Log::error('Admin driver vehicle delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ADMIN_DRIVER_VEHICLE_DELETE_FAILED', 'Unable to unassign vehicle.');
        }
    }

    private function resolveDriver(Request $request, string $driver_uuid): Driver
    {
        $driverQuery = Driver::where('uuid', $driver_uuid);
        if ($this->isMerchant($request)) {
            $carrierId = $this->merchantCarrierId($request);
            $driverQuery->where('carrier_id', $carrierId ?? 0);
        }

        return $driverQuery->firstOrFail();
    }

    private function resolveVehicleForUser(User $user, string $vehicleUuid): Vehicle
    {
        $query = Vehicle::where('uuid', $vehicleUuid);
        if ($user->role === 'user' && !empty($user->account_id)) {
            $query->where('account_id', $user->account_id);
        }

        return $query->firstOrFail();
    }

    private function isMerchant(Request $request): bool
    {
        return $request->user()?->role === 'user';
    }

    private function resolveMerchant(Request $request): ?Merchant
    {
        $user = $request->user();
        if (!$user) {
            return null;
        }

        $merchant = $user->merchants()->orderBy('merchants.id')->first();
        if (!$merchant) {
            $merchant = $user->ownedMerchants()->orderBy('id')->first();
        }

        return $merchant;
    }

    private function merchantCarrierId(Request $request): ?int
    {
        $merchant = $this->resolveMerchant($request);
        if (!$merchant) {
            return null;
        }

        return Carrier::where('merchant_id', $merchant->id)->value('id');
    }
}
