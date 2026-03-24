<?php

namespace App\Jobs;

use App\Mail\ShipmentOfferFailedMail;
use App\Models\Shipment;
use App\Services\LoggedMailSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendOfferFailedEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $shipmentId)
    {
    }

    public function handle(LoggedMailSender $loggedMailSender): void
    {
        $shipment = Shipment::with(['merchant', 'pickupLocation', 'dropoffLocation'])->find($this->shipmentId);

        if (!$shipment || empty($shipment->merchant?->support_email)) {
            return;
        }

        $loggedMailSender->send(
            new ShipmentOfferFailedMail($shipment),
            to: $shipment->merchant->support_email,
            context: [
                'account_id' => $shipment->account_id,
                'merchant_id' => $shipment->merchant_id,
                'environment_id' => $shipment->environment_id,
                'related_type' => Shipment::class,
                'related_id' => $shipment->id,
            ],
        );
    }
}
