<?php

namespace App\Jobs;

use App\Models\Booking;
use App\Models\Carrier;
use App\Services\Carriers\CarrierManager;
use App\Services\Carriers\DTO\BookingDTO;
use App\Services\Carriers\DTO\QuoteOptionDTO;
use App\Services\Carriers\DTO\ShipmentDTO;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class BookShipmentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $bookingId)
    {
    }

    public function handle(CarrierManager $carrierManager): void
    {
        $booking = Booking::with([
            'shipment.parcels',
            'shipment.pickupLocation',
            'shipment.dropoffLocation',
            'quoteOption',
            'merchant',
        ])->findOrFail($this->bookingId);
        $carrier = Carrier::where('code', $booking->carrier_code)->first();
        if ($carrier && $carrier->type === 'internal') {
            $booking->shipment->update(['status' => 'booked']);
            return;
        }

        $shipment = $booking->shipment;
        $shipmentDto = new ShipmentDTO([
            'shipment_uuid' => $shipment->uuid,
            'merchant_uuid' => $booking->merchant->uuid,
            'pickup_address' => $shipment->pickupAddressArray(),
            'dropoff_address' => $shipment->dropoffAddressArray(),
            'parcels' => $shipment->parcels->toArray(),
            'collection_date' => optional($shipment->collection_date)?->toIso8601String(),
            'metadata' => $shipment->metadata,
        ]);

        $optionDto = new QuoteOptionDTO([
            'carrier_code' => $booking->quoteOption->carrier_code,
            'service_code' => $booking->quoteOption->service_code,
            'currency' => $booking->quoteOption->currency,
            'amount' => $booking->quoteOption->amount,
            'tax_amount' => $booking->quoteOption->tax_amount,
            'total_amount' => $booking->quoteOption->total_amount,
            'eta_from' => optional($booking->quoteOption->eta_from)?->toIso8601String(),
            'eta_to' => optional($booking->quoteOption->eta_to)?->toIso8601String(),
            'rules' => $booking->quoteOption->rules,
        ]);

        $adapter = $carrierManager->adapter($booking->carrier_code);
        $carrierBooking = $adapter->book($shipmentDto, $optionDto);

        $booking->update([
            'carrier_job_id' => $carrierBooking->carrierJobId,
            'label_url' => $carrierBooking->labelUrl,
            'status' => $carrierBooking->status,
        ]);

        $shipment->update(['status' => 'booked']);
    }
}
