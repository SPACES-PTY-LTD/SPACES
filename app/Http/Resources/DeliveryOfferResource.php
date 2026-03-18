<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsMerchantTimestamps;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeliveryOfferResource extends JsonResource
{
    use FormatsMerchantTimestamps;

    public function toArray(Request $request): array
    {
        return [
            'offer_id' => $this->uuid,
            'shipment_id' => optional($this->shipment)->uuid,
            'driver_id' => optional($this->driver)->uuid,
            'driver_name' => optional(optional($this->driver)->user)->name,
            'status' => $this->status,
            'sequence' => $this->sequence,
            'offered_at' => $this->formatDateForMerchantTimezone($this->offered_at, $request),
            'expires_at' => $this->formatDateForMerchantTimezone($this->expires_at, $request),
            'responded_at' => $this->formatDateForMerchantTimezone($this->responded_at, $request),
            'response_reason' => $this->response_reason,
            'shipment' => $this->whenLoaded('shipment', function () use ($request) {
                return [
                    'shipment_id' => $this->shipment->uuid,
                    'merchant_order_ref' => $this->shipment->merchant_order_ref,
                    'delivery_note_number' => $this->shipment->delivery_note_number,
                    'pickup_location' => LocationResource::make($this->shipment->pickupLocation),
                    'dropoff_location' => LocationResource::make($this->shipment->dropoffLocation),
                    'requested_vehicle_type_id' => optional($this->shipment->requestedVehicleType)->uuid,
                    'status' => $this->shipment->status,
                    'ready_at' => $this->formatDateForMerchantTimezone($this->shipment->ready_at, $request),
                ];
            }),
        ];
    }
}
