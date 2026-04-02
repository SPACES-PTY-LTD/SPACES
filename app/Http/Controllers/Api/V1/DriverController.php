<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ImportDriversRequest;
use App\Http\Requests\ListDriversRequest;
use App\Http\Requests\StoreDriverRequest;
use App\Http\Requests\UpdateDriverRequest;
use App\Http\Requests\UpdateDriverPasswordRequest;
use App\Http\Resources\DriverResource;
use App\Services\DriverService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class DriverController extends Controller
{
    public function index(ListDriversRequest $request, DriverService $service)
    {
        try {
            $drivers = $service->listDrivers($request->user(), $request->validated());

            return ApiResponse::paginated($drivers, DriverResource::collection($drivers));
        } catch (Throwable $e) {
            Log::error('Driver list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'DRIVER_LIST_FAILED', 'Unable to list drivers.');
        }
    }

    public function show(Request $request, string $driver_uuid, DriverService $service)
    {
        try {
            $driver = $service->getDriver($request->user(), $driver_uuid, $request->query('merchant_id'));

            return ApiResponse::success(new DriverResource($driver));
        } catch (Throwable $e) {
            Log::error('Driver fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'DRIVER_NOT_FOUND', 'Driver not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function store(StoreDriverRequest $request, DriverService $service)
    {
        try {
            $driver = $service->createDriver($request->user(), $request->validated());

            return ApiResponse::success(new DriverResource($driver), [], Response::HTTP_CREATED);
        } catch (\RuntimeException $e) {
            return ApiResponse::error('MERCHANT_NOT_FOUND', 'Merchant profile not found.', [], Response::HTTP_FORBIDDEN);
        } catch (Throwable $e) {
            Log::error('Driver create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'DRIVER_CREATE_FAILED', 'Unable to create driver.');
        }
    }

    public function update(UpdateDriverRequest $request, string $driver_uuid, DriverService $service)
    {
        try {
            $driver = $service->updateDriver($request->user(), $driver_uuid, $request->validated());

            return ApiResponse::success(new DriverResource($driver));
        } catch (Throwable $e) {
            Log::error('Driver update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'DRIVER_UPDATE_FAILED', 'Unable to update driver.');
        }
    }

    public function destroy(string $driver_uuid, DriverService $service)
    {
        try {
            $service->deleteDriver(request()->user(), $driver_uuid);

            return ApiResponse::success(['message' => 'Driver deleted']);
        } catch (Throwable $e) {
            Log::error('Driver delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'DRIVER_DELETE_FAILED', 'Unable to delete driver.');
        }
    }

    public function updatePassword(UpdateDriverPasswordRequest $request, string $driver_uuid, DriverService $service)
    {
        try {
            $driver = $service->updateDriverPassword($request->user(), $driver_uuid, $request->validated()['password']);

            return ApiResponse::success(new DriverResource($driver));
        } catch (Throwable $e) {
            Log::error('Driver password update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'DRIVER_PASSWORD_UPDATE_FAILED', 'Unable to update driver password.');
        }
    }

    public function import(ImportDriversRequest $request, DriverService $service)
    {
        try {
            $result = $service->importDrivers($request->user(), $request->validated());

            return ApiResponse::success($result);
        } catch (Throwable $e) {
            Log::error('Driver import failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'DRIVER_IMPORT_FAILED', 'Unable to import drivers.');
        }
    }
}
