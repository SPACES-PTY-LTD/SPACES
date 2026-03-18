<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsMerchantTimestamps;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TrackingEventResource extends JsonResource
{
    use FormatsMerchantTimestamps;

    public function toArray(Request $request): array
    {
        return [
            'tracking_event_id' => $this->uuid,
            'merchant_id' => optional($this->merchant)->uuid,
            'shipment_id' => optional($this->shipment)->uuid,
            'booking_id' => optional($this->booking)->uuid,
            'event_code' => $this->event_code,
            'event_description' => $this->event_description,
            'occurred_at' => $this->formatDateForMerchantTimezone($this->occurred_at, $request),
            'payload' => $this->payload,
        ];
    }
}
