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

class ImportProviderLocationsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(
        public int $userId,
        public int $merchantId,
        public string $merchantUuid,
        public string $providerUuid,
        public ?bool $onlyWithGeofences = null
    ) {
    }

    public function handle(MerchantIntegrationService $service): void
    {
        $context = [
            'job' => self::class,
            'attempt' => $this->attempts(),
            'tries' => $this->tries,
            'user_id' => $this->userId,
            'merchant_id' => $this->merchantId,
            'merchant_uuid' => $this->merchantUuid,
            'provider_uuid' => $this->providerUuid,
            'only_with_geofences' => $this->onlyWithGeofences,
        ];

        Log::info('Provider locations import job started.', $context);

        try {
            $user = User::query()->find($this->userId);
            if (!$user) {
                Log::warning('Skipping provider locations import; user not found.', [
                    ...$context,
                ]);

                $service->completeImportByMerchantId($this->merchantId, 'locations', 0, 'Import user not found.');
                Log::info('Provider locations import job completed with skip (missing user).', $context);
                return;
            }

            $result = $service->importProviderLocations(
                $user,
                $this->providerUuid,
                $this->merchantUuid,
                $this->onlyWithGeofences
            );

            $service->completeImportByMerchantId(
                $this->merchantId,
                'locations',
                (int) ($result['imported_count'] ?? 0),
                null
            );
        } catch (\Throwable $exception) {
            $service->completeImportByMerchantId($this->merchantId, 'locations', null, $exception->getMessage());
            Log::error('Provider locations import job failed.', [
                ...$context,
                'error' => $exception->getMessage(),
                'exception' => get_class($exception),
                'trace' => $exception->getTraceAsString(),
            ]);
            throw $exception;
        }
    }
}
