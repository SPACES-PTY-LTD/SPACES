<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VehicleActivityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $run = $this->run;
        $driver = $run?->driver;
        $driverUser = $driver?->user;
        $vehicle = $this->vehicle;
        $lastDriver = $vehicle?->relationLoaded('lastDriver') ? $vehicle->lastDriver : null;
        $lastDriverUser = $lastDriver?->relationLoaded('user') ? $lastDriver->user : null;

        return [
            'activity_id' => $this->uuid,
            'merchant' => $this->merchant ? [
                'merchant_id' => $this->merchant->uuid,
                'name' => $this->merchant->name,
                'status' => $this->merchant->status,
            ] : null,
            'vehicle' => $vehicle ? [
                'vehicle_id' => $vehicle->uuid,
                'plate_number' => $vehicle->plate_number,
                'ref_code' => $vehicle->ref_code,
                'make' => $vehicle->make,
                'model' => $vehicle->model,
                'is_active' => (bool) $vehicle->is_active,
                'last_driver_id' => $lastDriver?->uuid,
                'driver_logged_at' => optional($vehicle->driver_logged_at)?->toIso8601String(),
                'last_driver' => $lastDriver ? [
                    'driver_id' => $lastDriver->uuid,
                    'name' => $lastDriverUser?->name,
                    'email' => $lastDriverUser?->email,
                    'telephone' => $lastDriverUser?->telephone,
                    'intergration_id' => $lastDriver->intergration_id,
                    'is_active' => (bool) $lastDriver->is_active,
                ] : null,
            ] : null,
            'location' => $this->location ? [
                'location_id' => $this->location->uuid,
                'name' => $this->location->name,
                'company' => $this->location->company,
                'code' => $this->location->code,
                'type' => $this->location->locationType ? [
                    'title' => $this->location->locationType->title,
                    'slug' => $this->location->locationType->slug,
                    'icon' => $this->location->locationType->icon,
                ] : null,
                'full_address' => $this->location->full_address,
                'city' => $this->location->city,
                'province' => $this->location->province,
                'country' => $this->location->country,
            ] : null,
            'run_id' => optional($run)->uuid,
            'driver' => $driver ? [
                'driver_id' => $driver->uuid,
                'name' => $driverUser?->name,
                'email' => $driverUser?->email,
                'telephone' => $driverUser?->telephone,
                'intergration_id' => $driver->intergration_id,
                'is_active' => (bool) $driver->is_active,
            ] : null,
            'shipment' => $this->shipment ? [
                'shipment_id' => $this->shipment->uuid,
                'merchant_order_ref' => $this->shipment->merchant_order_ref,
                'status' => $this->shipment->status,
                'auto_created' => (bool) $this->shipment->auto_created,
            ] : null,
            'event_type' => $this->event_type,
            'occurred_at' => optional($this->occurred_at)?->toIso8601String(),
            'entered_at' => optional($this->entered_at)?->toIso8601String(),
            'exited_at' => optional($this->exited_at)?->toIso8601String(),
            'latitude' => $this->latitude !== null ? (float) $this->latitude : null,
            'longitude' => $this->longitude !== null ? (float) $this->longitude : null,
            'speed_kph' => $this->speed_kph !== null ? (float) $this->speed_kph : null,
            'speed_limit_kph' => $this->speed_limit_kph !== null ? (float) $this->speed_limit_kph : null,
            'exit_reason' => $this->exit_reason,
            'metadata' => $this->metadata,
            'created_at' => optional($this->created_at)?->toIso8601String(),
        ];
    }
}
