<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsMerchantTimestamps;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingResource extends JsonResource
{
    use FormatsMerchantTimestamps;

    public function toArray(Request $request): array
    {
        $shipment = $this->whenLoaded('shipment');
        $runDriver = $shipment?->currentRunShipment?->run?->driver;

        return [
            'booking_id' => $this->uuid,
            'merchant' => [
                'merchant_id' => optional($this->merchant)->uuid,
                'name' => optional($this->merchant)->name,
            ],
            'environment_id' => optional($this->environment)->uuid,
            'shipment' => new ShipmentResource($this->whenLoaded('shipment')),
            'quote_option' => new QuoteOptionResource($this->whenLoaded('quoteOption')),
            'status' => $this->status,
            'carrier_code' => $this->carrier_code,
            'carrier_job_id' => $this->carrier_job_id,
            'label_url' => $this->label_url,
            'current_driver_id' => $runDriver?->uuid ?? optional($this->currentDriver)->uuid,
            'booked_at' => $this->formatDateForMerchantTimezone($this->booked_at, $request),
            'collected_at' => $this->formatDateForMerchantTimezone($this->collected_at, $request),
            'delivered_at' => $this->formatDateForMerchantTimezone($this->delivered_at, $request),
            'returned_at' => $this->formatDateForMerchantTimezone($this->returned_at, $request),
            'cancelled_at' => $this->formatDateForMerchantTimezone($this->cancelled_at, $request),
            'odometer_at_request' => $this->odometer_at_request,
            'odometer_at_collection' => $this->odometer_at_collection,
            'odometer_at_delivery' => $this->odometer_at_delivery,
            'odometer_at_return' => $this->odometer_at_return,
            'total_km_from_collection' => $this->total_km_from_collection,
            'cancellation_reason_code' => $this->cancellation_reason_code,
            'cancellation_reason_note' => $this->cancellation_reason_note,
            'cancel_reason' => $this->cancel_reason,
            'pod' => $this->pod ? [
                'pod_id' => $this->pod->uuid,
                'file_key' => $this->pod->file_key,
                'file_type' => $this->pod->file_type,
                'signed_by' => $this->pod->signed_by,
                'captured_by_user_id' => optional($this->pod->capturedBy)->uuid,
                'created_at' => $this->formatDateForMerchantTimezone($this->pod->created_at, $request),
            ] : null,
        ];
    }
}
