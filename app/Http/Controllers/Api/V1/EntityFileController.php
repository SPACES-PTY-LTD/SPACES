<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListExpiredEntityFilesRequest;
use App\Http\Requests\UploadEntityFileRequest;
use App\Http\Resources\EntityFileResource;
use App\Models\Merchant;
use App\Services\EntityFileService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class EntityFileController extends Controller
{
    public function expiredIndex(ListExpiredEntityFilesRequest $request, EntityFileService $service)
    {
        try {
            $files = $service->listExpiredFiles($request->user(), $request->validated());
            return ApiResponse::paginated($files, EntityFileResource::collection($files));
        } catch (Throwable $e) {
            Log::error('Expired file list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'EXPIRED_FILE_LIST_FAILED', 'Unable to list expired files.');
        }
    }

    public function shipmentIndex(Request $request, string $shipment_uuid, EntityFileService $service)
    {
        try {
            $files = $service->listShipmentFiles($request->user(), $shipment_uuid);
            return ApiResponse::paginated($files, EntityFileResource::collection($files));
        } catch (Throwable $e) {
            Log::error('Shipment file list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'SHIPMENT_FILE_LIST_FAILED', 'Unable to list shipment files.');
        }
    }

    public function shipmentStore(UploadEntityFileRequest $request, string $shipment_uuid, EntityFileService $service)
    {
        try {
            $file = $service->uploadShipmentFile($request->user(), $shipment_uuid, $request->validated());
            return ApiResponse::success(new EntityFileResource($file), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Shipment file upload failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'SHIPMENT_FILE_UPLOAD_FAILED', 'Unable to upload shipment file.');
        }
    }

    public function driverIndex(Request $request, string $driver_uuid, EntityFileService $service)
    {
        try {
            $files = $service->listDriverFiles($request->user(), $driver_uuid);
            return ApiResponse::paginated($files, EntityFileResource::collection($files));
        } catch (Throwable $e) {
            Log::error('Driver file list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'DRIVER_FILE_LIST_FAILED', 'Unable to list driver files.');
        }
    }

    public function driverStore(UploadEntityFileRequest $request, string $driver_uuid, EntityFileService $service)
    {
        try {
            $file = $service->uploadDriverFile($request->user(), $driver_uuid, $request->validated());
            return ApiResponse::success(new EntityFileResource($file), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Driver file upload failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'DRIVER_FILE_UPLOAD_FAILED', 'Unable to upload driver file.');
        }
    }

    public function vehicleIndex(Request $request, string $vehicle_uuid, EntityFileService $service)
    {
        try {
            $merchant = $request->attributes->get('merchant');
            $files = $service->listVehicleFiles($request->user(), $merchant, $vehicle_uuid);
            return ApiResponse::paginated($files, EntityFileResource::collection($files));
        } catch (Throwable $e) {
            Log::error('Vehicle file list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'VEHICLE_FILE_LIST_FAILED', 'Unable to list vehicle files.');
        }
    }

    public function vehicleStore(UploadEntityFileRequest $request, string $vehicle_uuid, EntityFileService $service)
    {
        try {
            $merchant = $request->attributes->get('merchant');
            $file = $service->uploadVehicleFile($request->user(), $merchant, $vehicle_uuid, $request->validated());
            return ApiResponse::success(new EntityFileResource($file), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Vehicle file upload failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'VEHICLE_FILE_UPLOAD_FAILED', 'Unable to upload vehicle file.');
        }
    }

    public function download(Request $request, string $file_uuid, EntityFileService $service)
    {
        try {
            $payload = $service->downloadForUser($request->user(), $file_uuid);
            if ($request->query('format') === 'url') {
                if ($payload['type'] === 'redirect') {
                    return ApiResponse::success(['url' => $payload['url']]);
                }

                return ApiResponse::error(
                    'FILE_DOWNLOAD_URL_UNAVAILABLE',
                    'A temporary download URL is not available for this file storage driver.',
                    [],
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }

            if ($payload['type'] === 'redirect') {
                return redirect()->away($payload['url']);
            }

            return response()->download(
                storage_path('app/private/'.$payload['path']),
                $payload['name'],
                $payload['mime_type'] ? ['Content-Type' => $payload['mime_type']] : []
            );
        } catch (Throwable $e) {
            Log::error('File download failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'FILE_DOWNLOAD_FAILED', 'Unable to download file.');
        }
    }

    public function destroy(Request $request, string $file_uuid, EntityFileService $service)
    {
        try {
            $service->deleteForUser($request->user(), $file_uuid);
            return ApiResponse::success(['message' => 'File deleted']);
        } catch (Throwable $e) {
            Log::error('File delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'FILE_DELETE_FAILED', 'Unable to delete file.');
        }
    }

    public function ownDriverIndex(Request $request, EntityFileService $service)
    {
        try {
            $files = $service->listOwnDriverFiles($request->user());
            return ApiResponse::paginated($files, EntityFileResource::collection($files));
        } catch (Throwable $e) {
            Log::error('Own driver file list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'OWN_DRIVER_FILE_LIST_FAILED', 'Unable to list driver files.');
        }
    }

    public function ownDriverStore(UploadEntityFileRequest $request, EntityFileService $service)
    {
        try {
            $file = $service->uploadOwnDriverFile($request->user(), $request->validated());
            return ApiResponse::success(new EntityFileResource($file), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Own driver file upload failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'OWN_DRIVER_FILE_UPLOAD_FAILED', 'Unable to upload driver file.');
        }
    }

    public function ownDriverShipmentIndex(Request $request, string $shipment_uuid, EntityFileService $service)
    {
        try {
            $files = $service->listOwnDriverShipmentFiles($request->user(), $shipment_uuid);
            return ApiResponse::paginated($files, EntityFileResource::collection($files));
        } catch (Throwable $e) {
            Log::error('Own driver shipment file list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'OWN_DRIVER_SHIPMENT_FILE_LIST_FAILED', 'Unable to list shipment files.');
        }
    }

    public function ownDriverShipmentStore(UploadEntityFileRequest $request, string $shipment_uuid, EntityFileService $service)
    {
        try {
            $file = $service->uploadOwnDriverShipmentFile($request->user(), $shipment_uuid, $request->validated());
            return ApiResponse::success(new EntityFileResource($file), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Own driver shipment file upload failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'OWN_DRIVER_SHIPMENT_FILE_UPLOAD_FAILED', 'Unable to upload shipment file.');
        }
    }

    public function ownDriverDownload(Request $request, string $file_uuid, EntityFileService $service)
    {
        return $this->download($request, $file_uuid, $service);
    }
}
