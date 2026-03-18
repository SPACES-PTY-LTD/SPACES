<?php

namespace App\Services\Carriers;

use App\Services\Carriers\DTO\BookingDTO;
use App\Services\Carriers\DTO\CancelResultDTO;
use App\Services\Carriers\DTO\LabelDTO;
use App\Services\Carriers\DTO\QuoteOptionDTO;
use App\Services\Carriers\DTO\QuoteOptionsDTO;
use App\Services\Carriers\DTO\ShipmentDTO;
use App\Services\Carriers\DTO\TrackingEventsDTO;

interface CarrierAdapter
{
    public function quote(ShipmentDTO $shipment): QuoteOptionsDTO;

    public function book(ShipmentDTO $shipment, QuoteOptionDTO $option): BookingDTO;

    public function cancel(BookingDTO $booking): CancelResultDTO;

    public function tracking(BookingDTO $booking): TrackingEventsDTO;

    public function label(BookingDTO $booking): LabelDTO;
}
