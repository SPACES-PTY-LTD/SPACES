<?php

namespace App\Http\Resources;

use App\Models\Booking;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MappedBookingReportResource extends JsonResource
{
    /**
     * @mixin Booking
     */
    public function toArray(Request $request): array
    {
        $shipment = $this->shipment;
        $currentRunShipment = $shipment?->currentRunShipment;
        $run = $currentRunShipment?->run;
        $vehicle = $run?->vehicle;
        $driver = $run?->driver ?? $this->currentDriver;
        $driverUser = $driver?->user;
        $latestShipmentActivity = $shipment?->latestVehicleActivity;
        $latestRunStop = $run?->latestLocationStop;
        $vehicleLocation = is_array($vehicle?->last_location_address) ? $vehicle->last_location_address : [];

        $latitude = $latestShipmentActivity?->latitude
            ?? $latestRunStop?->latitude
            ?? $vehicleLocation['latitude']
            ?? null;
        $longitude = $latestShipmentActivity?->longitude
            ?? $latestRunStop?->longitude
            ?? $vehicleLocation['longitude']
            ?? null;

        $vehicleLabel = collect([
            $vehicle?->plate_number,
            $vehicle?->ref_code,
            trim(implode(' ', array_filter([$vehicle?->make, $vehicle?->model]))),
        ])->first(fn (?string $value) => filled($value));

        return [
            'booking_id' => $this->uuid,
            'shipment_id' => $shipment?->uuid,
            'status' => $this->status,
            'latitude' => $latitude !== null ? (float) $latitude : null,
            'longitude' => $longitude !== null ? (float) $longitude : null,
            'merchant_order_ref' => $shipment?->merchant_order_ref,
            'driver_name' => $driverUser?->name,
            'vehicle_plate_number' => $vehicle?->plate_number,
            'vehicle_label' => $vehicleLabel,
            'updated_at' => optional($latestShipmentActivity?->occurred_at ?? $latestRunStop?->occurred_at ?? $vehicle?->location_updated_at ?? $this->updated_at)
                ?->toIso8601String(),
        ];
    }
}
