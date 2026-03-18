<?php

namespace App\Services\Carriers;

use App\Services\Carriers\DTO\BookingDTO;
use App\Services\Carriers\DTO\CancelResultDTO;
use App\Services\Carriers\DTO\LabelDTO;
use App\Services\Carriers\DTO\QuoteOptionDTO;
use App\Services\Carriers\DTO\QuoteOptionsDTO;
use App\Services\Carriers\DTO\ShipmentDTO;
use App\Services\Carriers\DTO\TrackingEventsDTO;
use Illuminate\Support\Str;

class DummyCarrierAdapter implements CarrierAdapter
{
    public function quote(ShipmentDTO $shipment): QuoteOptionsDTO
    {
        $options = [
            new QuoteOptionDTO([
                'carrier_code' => 'dummy',
                'service_code' => 'same_day',
                'currency' => 'ZAR',
                'amount' => 100.00,
                'tax_amount' => 15.00,
                'total_amount' => 115.00,
                'eta_from' => now()->addHours(2)->toIso8601String(),
                'eta_to' => now()->addHours(4)->toIso8601String(),
                'rules' => ['max_weight_kg' => 30],
            ]),
            new QuoteOptionDTO([
                'carrier_code' => 'dummy',
                'service_code' => 'next_day',
                'currency' => 'ZAR',
                'amount' => 80.00,
                'tax_amount' => 12.00,
                'total_amount' => 92.00,
                'eta_from' => now()->addDay()->toIso8601String(),
                'eta_to' => now()->addDays(2)->toIso8601String(),
                'rules' => ['max_weight_kg' => 50],
            ]),
        ];

        return new QuoteOptionsDTO($options);
    }

    public function book(ShipmentDTO $shipment, QuoteOptionDTO $option): BookingDTO
    {
        return new BookingDTO([
            'booking_uuid' => (string) Str::uuid(),
            'carrier_code' => $option->carrierCode,
            'status' => 'booked',
            'carrier_job_id' => 'DUMMY-'.Str::upper(Str::random(8)),
            'label_url' => 'https://example.com/labels/dummy.pdf',
        ]);
    }

    public function cancel(BookingDTO $booking): CancelResultDTO
    {
        return new CancelResultDTO([
            'status' => 'cancelled',
            'reason' => null,
        ]);
    }

    public function tracking(BookingDTO $booking): TrackingEventsDTO
    {
        return new TrackingEventsDTO([
            [
                'event_code' => 'picked_up',
                'event_description' => 'Shipment picked up by courier.',
                'occurred_at' => now()->subHour()->toIso8601String(),
                'payload' => ['driver' => 'Dummy Driver'],
            ],
            [
                'event_code' => 'in_transit',
                'event_description' => 'Shipment in transit.',
                'occurred_at' => now()->toIso8601String(),
                'payload' => [],
            ],
        ]);
    }

    public function label(BookingDTO $booking): LabelDTO
    {
        return new LabelDTO([
            'label_url' => 'https://example.com/labels/dummy.pdf',
        ]);
    }
}
