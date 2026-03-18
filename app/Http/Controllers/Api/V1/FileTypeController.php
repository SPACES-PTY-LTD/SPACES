<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFileTypeRequest;
use App\Http\Requests\UpdateFileTypeRequest;
use App\Http\Resources\FileTypeResource;
use App\Models\Merchant;
use App\Services\FileTypeService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class FileTypeController extends Controller
{
    public function index(Request $request, FileTypeService $service)
    {
        try {
            $merchant = $request->attributes->get('merchant');
            $types = $service->listFileTypes($request->user(), $merchant, $request->all());

            return ApiResponse::paginated($types, FileTypeResource::collection($types));
        } catch (Throwable $e) {
            Log::error('File type list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'FILE_TYPE_LIST_FAILED', 'Unable to list file types.');
        }
    }

    public function store(StoreFileTypeRequest $request, FileTypeService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $request->validated('merchant_id'))->firstOrFail();
            $fileType = $service->createFileType($request->user(), $merchant, $request->validated());

            return ApiResponse::success(new FileTypeResource($fileType), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('File type create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'FILE_TYPE_CREATE_FAILED', 'Unable to create file type.');
        }
    }

    public function update(UpdateFileTypeRequest $request, string $file_type_uuid, FileTypeService $service)
    {
        try {
            $fileType = $service->updateFileType($request->user(), $file_type_uuid, $request->validated());

            return ApiResponse::success(new FileTypeResource($fileType));
        } catch (Throwable $e) {
            Log::error('File type update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'FILE_TYPE_UPDATE_FAILED', 'Unable to update file type.');
        }
    }

    public function driverUploadTypes(Request $request, FileTypeService $service)
    {
        try {
            return ApiResponse::success(
                FileTypeResource::collection(
                    collect($service->listDriverUploadTypes($request->user(), $request->query('entity_type')))
                )
            );
        } catch (Throwable $e) {
            Log::error('Driver file type list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'DRIVER_FILE_TYPE_LIST_FAILED', 'Unable to list driver file types.');
        }
    }
}
