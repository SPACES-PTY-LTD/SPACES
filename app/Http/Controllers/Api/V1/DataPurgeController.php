<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\DataPurgeRequest;
use App\Jobs\PurgeMerchantDataJob;
use App\Models\DataPurge;
use App\Models\Merchant;
use App\Support\ApiResponse;
use Illuminate\Database\ConcurrencyErrorDetector;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class DataPurgeController extends Controller
{
    public function purge(
        DataPurgeRequest $request,
        string $merchant_uuid
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
            if (! $user || ! $merchant->account || (int) $merchant->account->owner_user_id !== (int) $user->id) {
                return ApiResponse::error(
                    'FORBIDDEN',
                    'Only the account owner can purge merchant data.',
                    [],
                    Response::HTTP_FORBIDDEN
                );
            }

            if (! $user || ! Hash::check($request->validated('password'), $user->password)) {
                return ApiResponse::error(
                    'INVALID_CREDENTIALS',
                    'The provided password is incorrect.',
                    [],
                    Response::HTTP_UNAUTHORIZED
                );
            }

            $active = DataPurge::where('active_merchant_id', $merchant->id)->first();
            if ($active) {
                return ApiResponse::success($active->toStatus(), status: Response::HTTP_ACCEPTED);
            }
            $connection = config('queue.default');
            if (! in_array(config("queue.connections.{$connection}.driver"), ['database', 'redis', 'sqs', 'beanstalkd'], true)) {
                return ApiResponse::error('PURGE_QUEUE_UNAVAILABLE', 'Background deletion requires a persistent queue worker.', [], Response::HTTP_SERVICE_UNAVAILABLE);
            }
            try {
                $purge = DataPurge::create([
                    'merchant_id' => $merchant->id,
                    'active_merchant_id' => $merchant->id,
                    'user_id' => $user->id,
                    'types' => $request->validated('types'),
                    'status' => 'queued',
                ]);
            } catch (UniqueConstraintViolationException $e) {
                $active = DataPurge::where('active_merchant_id', $merchant->id)->first();
                if (! $active) {
                    throw $e;
                }

                return ApiResponse::success($active->toStatus(), status: Response::HTTP_ACCEPTED);
            }
            try {
                PurgeMerchantDataJob::dispatch($purge->id)->onConnection($connection);
            } catch (Throwable $e) {
                $purge->update([
                    'status' => 'failed', 'active_merchant_id' => null,
                    'finished_at' => now(), 'error_message' => 'Unable to queue deletion. Please submit a new request.',
                ]);
                throw $e;
            }

            return ApiResponse::success($purge->toStatus(), status: Response::HTTP_ACCEPTED);
        } catch (Throwable $e) {
            Log::error('Merchant data purge failed', [
                'request_id' => ApiResponse::requestId(),
                'merchant_uuid' => $merchant_uuid,
                'error' => $e->getMessage(),
            ]);

            if ((new ConcurrencyErrorDetector)->causedByConcurrencyError($e)) {
                return ApiResponse::error(
                    'MERCHANT_DATA_PURGE_BUSY',
                    'Data is currently being updated by another process. Please try again shortly.',
                    [],
                    Response::HTTP_CONFLICT
                );
            }

            return $this->apiError($e, 'MERCHANT_DATA_PURGE_FAILED', 'Unable to purge merchant data.');
        }
    }

    public function status(Request $request, string $merchant_uuid, ?string $purge_uuid = null)
    {
        $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
        if (! $request->user() || (int) $merchant->account?->owner_user_id !== (int) $request->user()->id) {
            return ApiResponse::error('FORBIDDEN', 'Only the account owner can view data deletion status.', [], Response::HTTP_FORBIDDEN);
        }
        $query = DataPurge::where('merchant_id', $merchant->id);
        $purge = $purge_uuid
            ? $query->where('uuid', $purge_uuid)->firstOrFail()
            : $query->latest('id')->first();

        return ApiResponse::success($purge?->toStatus());
    }
}
