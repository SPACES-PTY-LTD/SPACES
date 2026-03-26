<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\MerchantIntegrationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ImportProviderDriversJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(
        public int $userId,
        public int $merchantId,
        public string $merchantUuid,
        public string $providerUuid
    ) {
        $this->onQueue('imports');
    }

    public function handle(MerchantIntegrationService $service): void
    {
        try {
            $user = User::query()->find($this->userId);
            if (!$user) {
                Log::warning('Skipping provider drivers import; user not found.', [
                    'user_id' => $this->userId,
                    'merchant_id' => $this->merchantId,
                    'provider_uuid' => $this->providerUuid,
                ]);

                $service->completeImportByMerchantId($this->merchantId, 'drivers', 0, 'Import user not found.');
                return;
            }

            $result = $service->importProviderDrivers($user, $this->providerUuid, $this->merchantUuid);
            $service->completeImportByMerchantId(
                $this->merchantId,
                'drivers',
                (int) ($result['imported_count'] ?? 0),
                null
            );
        } catch (\Throwable $exception) {
            $service->completeImportByMerchantId($this->merchantId, 'drivers', null, $exception->getMessage());
            throw $exception;
        }
    }
}
