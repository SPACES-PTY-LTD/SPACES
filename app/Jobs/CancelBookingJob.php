<?php

namespace App\Jobs;

use App\Models\Booking;
use App\Models\Carrier;
use App\Services\Carriers\CarrierManager;
use App\Services\Carriers\DTO\BookingDTO;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class CancelBookingJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $bookingId, public array $data)
    {
    }

    public function handle(CarrierManager $carrierManager): void
    {
        $booking = Booking::with(['shipment', 'merchant'])->findOrFail($this->bookingId);
        $carrier = Carrier::where('code', $booking->carrier_code)->first();
        if ($carrier && $carrier->type === 'internal') {
            $booking->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'cancellation_reason_code' => $this->data['reason_code'] ?? null,
                'cancellation_reason_note' => $this->data['reason_note'] ?? null,
                'cancel_reason' => $this->data['reason'] ?? null,
            ]);
            $booking->shipment()->update(['status' => 'cancelled']);
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
        $adapter->cancel($bookingDto);

        $booking->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'cancellation_reason_code' => $this->data['reason_code'],
            'cancellation_reason_note' => $this->data['reason_note'] ?? null,
        ]);

        $booking->shipment()->update(['status' => 'cancelled']);
    }
}
