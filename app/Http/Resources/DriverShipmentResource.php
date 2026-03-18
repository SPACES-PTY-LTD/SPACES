<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsMerchantTimestamps;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DriverShipmentResource extends JsonResource
{
    use FormatsMerchantTimestamps;

    public function toArray(Request $request): array
    {
        $shipment = ShipmentResource::make($this)->toArray($request);
        $booking = $this->whenLoaded('booking');
        $runDriver = $this->currentRunShipment?->run?->driver;

        $shipment['booking'] = $booking ? [
            'booking_id' => $booking->uuid,
            'status' => $booking->status,
            'carrier_code' => $booking->carrier_code,
            'carrier_job_id' => $booking->carrier_job_id,
            'label_url' => $booking->label_url,
            'current_driver_id' => $runDriver?->uuid ?? optional($booking->currentDriver)->uuid,
            'booked_at' => $this->formatDateForMerchantTimezone($booking->booked_at, $request),
            'collected_at' => $this->formatDateForMerchantTimezone($booking->collected_at, $request),
            'delivered_at' => $this->formatDateForMerchantTimezone($booking->delivered_at, $request),
            'returned_at' => $this->formatDateForMerchantTimezone($booking->returned_at, $request),
            'cancelled_at' => $this->formatDateForMerchantTimezone($booking->cancelled_at, $request),
            'odometer_at_request' => $booking->odometer_at_request,
            'odometer_at_collection' => $booking->odometer_at_collection,
            'odometer_at_delivery' => $booking->odometer_at_delivery,
            'odometer_at_return' => $booking->odometer_at_return,
            'total_km_from_collection' => $booking->total_km_from_collection,
            'cancellation_reason_code' => $booking->cancellation_reason_code,
            'cancellation_reason_note' => $booking->cancellation_reason_note,
            'cancel_reason' => $booking->cancel_reason,
            'pod' => $booking->pod ? [
                'pod_id' => $booking->pod->uuid,
                'file_key' => $booking->pod->file_key,
                'file_type' => $booking->pod->file_type,
                'signed_by' => $booking->pod->signed_by,
                'captured_by_user_id' => optional($booking->pod->capturedBy)->uuid,
                'created_at' => $this->formatDateForMerchantTimezone($booking->pod->created_at, $request),
            ] : null,
        ] : null;

        return $shipment;
    }
}
