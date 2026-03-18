<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCancelReasonRequest;
use App\Http\Requests\UpdateCancelReasonRequest;
use App\Http\Resources\CancelReasonResource;
use App\Models\CancelReason;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AdminCancelReasonController extends Controller
{
    public function index(Request $request)
    {
        try {
            $perPage = min((int) $request->get('per_page', 15), 100);
            $query = CancelReason::query()->orderByDesc('created_at');

            if ($request->has('enabled')) {
                $query->where('enabled', (bool) $request->get('enabled'));
            }

            $reasons = $query->paginate($perPage);

            return ApiResponse::paginated($reasons, CancelReasonResource::collection($reasons));
        } catch (Throwable $e) {
            Log::error('Admin cancel reasons list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_CANCEL_REASONS_FAILED', 'Unable to list cancel reasons.');
        }
    }

    public function show(string $cancel_reason_uuid)
    {
        try {
            $reason = CancelReason::where('uuid', $cancel_reason_uuid)->firstOrFail();

            return ApiResponse::success(new CancelReasonResource($reason));
        } catch (Throwable $e) {
            Log::error('Admin cancel reason fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_CANCEL_REASON_NOT_FOUND', 'Cancel reason not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function store(StoreCancelReasonRequest $request)
    {
        try {
            $reason = CancelReason::create($request->validated());

            return ApiResponse::success(new CancelReasonResource($reason), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Admin cancel reason create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_CANCEL_REASON_CREATE_FAILED', 'Unable to create cancel reason.');
        }
    }

    public function update(UpdateCancelReasonRequest $request, string $cancel_reason_uuid)
    {
        try {
            $reason = CancelReason::where('uuid', $cancel_reason_uuid)->firstOrFail();
            $reason->update($request->validated());

            return ApiResponse::success(new CancelReasonResource($reason));
        } catch (Throwable $e) {
            Log::error('Admin cancel reason update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_CANCEL_REASON_UPDATE_FAILED', 'Unable to update cancel reason.');
        }
    }

    public function destroy(string $cancel_reason_uuid)
    {
        try {
            $reason = CancelReason::where('uuid', $cancel_reason_uuid)->firstOrFail();
            $reason->delete();

            return ApiResponse::success(['message' => 'Cancel reason deleted']);
        } catch (Throwable $e) {
            Log::error('Admin cancel reason delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_CANCEL_REASON_DELETE_FAILED', 'Unable to delete cancel reason.');
        }
    }
}
