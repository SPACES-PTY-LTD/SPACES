<?php

namespace App\Jobs;

use App\Models\Shipment;
use App\Models\TrackingEvent;
use App\Models\Carrier;
use App\Services\Carriers\CarrierManager;
use App\Services\Carriers\DTO\BookingDTO;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SyncTrackingJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $shipmentId)
    {
    }

    public function handle(CarrierManager $carrierManager): void
    {
        $shipment = Shipment::with('booking', 'merchant')->findOrFail($this->shipmentId);
        $booking = $shipment->booking;

        if (!$booking) {
            return;
        }

        $carrier = Carrier::where('code', $booking->carrier_code)->first();
        if ($carrier && $carrier->type === 'internal') {
            return;
        }

        $bookingDto = new BookingDTO([
            'booking_uuid' => $booking->uuid,
            'carrier_code' => $booking->carrier_code,
            'status' => $booking->status,
            'carrier_job_id' => $booking->carrier_job_id,
            'label_url' => $booking->label_url,
        ]);

        $adapter = $carrierManager->adapter($booking->carrier_code);
        $eventsDto = $adapter->tracking($bookingDto);

        foreach ($eventsDto->events as $event) {
            TrackingEvent::create([
                'account_id' => $shipment->account_id,
                'merchant_id' => $shipment->merchant_id,
                'shipment_id' => $shipment->id,
                'booking_id' => $booking->id,
                'event_code' => $event['event_code'],
                'event_description' => $event['event_description'] ?? null,
                'occurred_at' => $event['occurred_at'] ?? now(),
                'payload' => $event['payload'] ?? null,
            ]);
        }
    }
}
