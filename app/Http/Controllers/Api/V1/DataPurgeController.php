<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\DataPurgeRequest;
use App\Models\Merchant;
use App\Services\DataPurgeService;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class DataPurgeController extends Controller
{
    public function purge(
        DataPurgeRequest $request,
        string $merchant_uuid,
        DataPurgeService $service
        ) {
        try {
            $merchant = Merchant::query()->where('uuid', $merchant_uuid)->firstOrFail();
            $payloadMerchantUuid = $request->validated('merchant_id');
            if ($payloadMerchantUuid !== $merchant->uuid) {
                return ApiResponse::error(
                    'MERCHANT_CONTEXT_MISMATCH',
                    'The merchant_id payload must match the route merchant.',
                    [],
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }

            $user = $request->user();
            if (!$user || !$merchant->account || (int) $merchant->account->owner_user_id !== (int) $user->id) {
                return ApiResponse::error(
                    'FORBIDDEN',
                    'Only the account owner can purge merchant data.',
                    [],
                    Response::HTTP_FORBIDDEN
                );
            }

            if (!$user || !Hash::check($request->validated('password'), $user->password)) {
                return ApiResponse::error(
                    'INVALID_CREDENTIALS',
                    'The provided password is incorrect.',
                    [],
                    Response::HTTP_UNAUTHORIZED
                );
            }

            $result = $service->purge($user, $merchant, $request->validated('types'));

            return ApiResponse::success($result);
        } catch (Throwable $e) {
            Log::error('Merchant data purge failed', [
                'request_id' => ApiResponse::requestId(),
                'merchant_uuid' => $merchant_uuid,
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'MERCHANT_DATA_PURGE_FAILED', 'Unable to purge merchant data.');
        }
    }
}
