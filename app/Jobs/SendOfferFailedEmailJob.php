<?php

namespace App\Jobs;

use App\Mail\ShipmentOfferFailedMail;
use App\Models\Shipment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendOfferFailedEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $shipmentId)
    {
    }

    public function handle(): void
    {
        $shipment = Shipment::with(['merchant', 'pickupLocation', 'dropoffLocation'])->find($this->shipmentId);

        if (!$shipment || empty($shipment->merchant?->support_email)) {
            return;
        }

        Mail::to($shipment->merchant->support_email)->send(new ShipmentOfferFailedMail($shipment));
    }
}
