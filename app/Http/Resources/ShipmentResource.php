<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsMerchantTimestamps;
use App\Http\Resources\VehicleActivityResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShipmentResource extends JsonResource
{
    use FormatsMerchantTimestamps;

    public function toArray(Request $request): array
    {
        $currentRunShipment = $this->relationLoaded('currentRunShipment')
            ? $this->currentRunShipment
            : null;
        $run = $currentRunShipment?->run;
        $driver = $run?->driver;
        $driverUser = $driver?->user;
        $vehicle = $run?->vehicle;
        $parcels = $this->relationLoaded('parcels') ? $this->parcels : collect();
        $totalParcelCount = $parcels->count();
        $scannedParcelCount = $parcels->filter(fn ($parcel) => $parcel->picked_up_scanned_at !== null)->count();

        return [
            'shipment_id' => $this->uuid,
            'merchant' => [
                'merchant_id' => optional($this->merchant)->uuid,
                'name' => optional($this->merchant)->name,
            ],
            'environment_id' => optional($this->environment)->uuid,
            'merchant_order_ref' => $this->merchant_order_ref,
            'delivery_note_number' => $this->delivery_note_number,
            'invoice_number' => $this->invoice_number,
            'invoiced_at' => $this->formatDateForMerchantTimezone($this->invoiced_at, $request),
            'status' => $this->status,
            'pickup_location' => new LocationResource($this->whenLoaded('pickupLocation')),
            'dropoff_location' => new LocationResource($this->whenLoaded('dropoffLocation')),
            'requested_vehicle_type_id' => optional($this->requestedVehicleType)->uuid,
            'pickup_instructions' => $this->pickup_instructions,
            'dropoff_instructions' => $this->dropoff_instructions,
            'ready_at' => $this->formatDateForMerchantTimezone($this->ready_at, $request),
            'collection_date' => $this->formatDateForMerchantTimezone($this->collection_date, $request),
            'service_type' => $this->service_type,
            'priority' => $this->priority,
            'auto_assign' => (bool) $this->auto_assign,
            'auto_created' => (bool) $this->auto_created,
            'notes' => $this->notes,
            'metadata' => $this->metadata,
            'run_id' => $currentRunShipment?->run?->uuid,
            'run_status' => $currentRunShipment?->run?->status,
            'run_sequence' => $currentRunShipment?->sequence,
            'run_shipment_status' => $currentRunShipment?->status,
            'driver' => $driver ? [
                'driver_id' => $driver->uuid,
                'name' => $driverUser?->name,
                'email' => $driverUser?->email,
                'telephone' => $driverUser?->telephone,
                'intergration_id' => $driver->intergration_id,
                'is_active' => (bool) $driver->is_active,
            ] : null,
            'vehicle' => $vehicle ? [
                'vehicle_id' => $vehicle->uuid,
                'plate_number' => $vehicle->plate_number,
                'ref_code' => $vehicle->ref_code,
                'make' => $vehicle->make,
                'model' => $vehicle->model,
                'is_active' => (bool) $vehicle->is_active,
            ] : null,
            'total_parcel_count' => $totalParcelCount,
            'scanned_parcel_count' => $scannedParcelCount,
            'all_parcels_scanned' => $totalParcelCount > 0 && $scannedParcelCount === $totalParcelCount,
            'parcels' => ShipmentParcelResource::collection($this->whenLoaded('parcels')),
            'stops' => VehicleActivityResource::collection($this->whenLoaded('vehicleActivities')),
            'offers' => DeliveryOfferResource::collection($this->whenLoaded('deliveryOffers')),
            'created_at' => $this->formatDateForMerchantTimezone($this->created_at, $request),
        ];
    }
}
