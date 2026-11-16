<?php

namespace App\Jobs;

use App\Models\DataPurge;
use App\Models\Merchant;
use App\Models\User;
use App\Services\DataPurgeService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\ConcurrencyErrorDetector;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class PurgeMerchantDataJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 300;

    public bool $failOnTimeout = true;

    // Never serialize a password or access token into the queue payload.
    public function __construct(public int $purgeId) {}

    public function handle(DataPurgeService $service): void
    {
        // Claim once. Duplicate deliveries must not reset a terminal state or
        // repeat a running operation; lost workers fail on their next delivery.
        if (DataPurge::whereKey($this->purgeId)->where('status', 'queued')->update([
            'status' => 'running', 'started_at' => now(),
        ]) !== 1) {
            return;
        }

        try {
            // Commit the results and audit entry with deletion. A redelivery cannot
            // repeat completed work, even if the worker died before acknowledging it.
            DB::transaction(function () use ($service) {
                $purge = DataPurge::lockForUpdate()->findOrFail($this->purgeId);
                if (in_array($purge->status, ['completed', 'failed'], true)) {
                    return;
                }
                $merchant = Merchant::findOrFail($purge->merchant_id);
                $user = User::findOrFail($purge->user_id);
                if ((int) $merchant->account?->owner_user_id !== (int) $user->id) {
                    throw ValidationException::withMessages(['owner' => 'The requesting user is no longer the account owner.']);
                }
                $result = $service->purge($user, $merchant, $purge->types,
                    fn (int $done, int $total, ?string $type) => app(\App\Services\DataPurgeProgress::class)->write($purge->uuid, $done, $total, $type)
                );
                $purge->update([
                    'status' => 'completed', 'result' => $result,
                    'finished_at' => now(), 'active_merchant_id' => null,
                ]);
            }, 3);
        } catch (Throwable $e) {
            // After-commit file dispatch errors must not claim committed data rolled back.
            if (DataPurge::find($this->purgeId)?->status === 'completed') {
                report($e);

                return;
            }
            throw $e;
        }
    }

    public function failed(?Throwable $exception): void
    {
        $message = 'Deletion failed. No database changes were committed. You can submit a new request.';
        if ($exception && (new ConcurrencyErrorDetector)->causedByConcurrencyError($exception)) {
            $message = 'Deletion could not acquire database locks. No database changes were committed. Try again when other updates have finished.';
        } elseif ($exception instanceof ValidationException) {
            $message = collect($exception->errors())->flatten()->first() ?? $message;
        } elseif ($exception instanceof \Illuminate\Queue\TimeoutExceededException) {
            $message = 'Deletion exceeded the worker time limit. No database changes were committed. Try fewer data types or contact support.';
        }
        DataPurge::whereKey($this->purgeId)->whereIn('status', ['queued', 'running'])->update([
            'status' => 'failed', 'error_message' => $message,
            'finished_at' => now(), 'active_merchant_id' => null,
        ]);
    }
}
