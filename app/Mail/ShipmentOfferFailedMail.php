<?php

namespace App\Mail;

use App\Models\Shipment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ShipmentOfferFailedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Shipment $shipment)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Shipment offer failed'
        );
    }

    public function content(): Content
    {
        $pickup = $this->shipment->pickupLocation?->full_address ?? $this->shipment->pickupLocation?->address_line_1;
        $dropoff = $this->shipment->dropoffLocation?->full_address ?? $this->shipment->dropoffLocation?->address_line_1;

        return new Content(
            text: 'emails.shipment-offer-failed',
            with: [
                'shipment' => $this->shipment,
                'pickup' => $pickup,
                'dropoff' => $dropoff,
            ]
        );
    }
}
