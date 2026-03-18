<?php

namespace App\Jobs;

use App\Services\DeliveryOfferService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ExpireDeliveryOfferJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $offerId)
    {
    }

    public function handle(DeliveryOfferService $deliveryOfferService): void
    {
        $deliveryOfferService->expireOfferById($this->offerId);
    }
}
