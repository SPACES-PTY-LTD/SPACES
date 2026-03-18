<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VehicleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $lastDriver = $this->relationLoaded('lastDriver') ? $this->lastDriver : null;
        $lastDriverUser = $lastDriver?->relationLoaded('user') ? $lastDriver->user : null;

        return [
            'vehicle_id' => $this->uuid,
            'merchant_id' => $this->merchant?->uuid ?? null,
            'type' => new VehicleTypeResource($this->vehicleType),
            'make' => $this->make,
            'model' => $this->model,
            'color' => $this->color,
            'plate_number' => $this->plate_number,
            'vin_number' => $this->vin_number,
            'engine_number' => $this->engine_number,
            'ref_code' => $this->ref_code,
            'odometer' => $this->odometer,
            'year' => $this->year,
            'last_location_address' => $this->last_location_address,
            'location_updated_at' => optional($this->location_updated_at)?->toIso8601String(),
            'last_driver_id' => $lastDriver?->uuid,
            'driver_logged_at' => optional($this->driver_logged_at)?->toIso8601String(),
            'last_driver' => $lastDriver ? [
                'driver_id' => $lastDriver->uuid,
                'name' => $lastDriverUser?->name,
                'email' => $lastDriverUser?->email,
                'telephone' => $lastDriverUser?->telephone,
                'intergration_id' => $lastDriver->intergration_id,
                'is_active' => (bool) $lastDriver->is_active,
            ] : null,
            'intergration_id' => $this->intergration_id,
            'photo_key' => $this->photo_key,
            'is_active' => (bool) $this->is_active,
            'maintenance_mode_at' => optional($this->maintenance_mode_at)?->toIso8601String(),
            'maintenance_expected_resolved_at' => optional($this->maintenance_expected_resolved_at)?->toIso8601String(),
            'maintenance_description' => $this->maintenance_description,
            'metadata' => $this->metadata,
            'imported_at' => optional($this->imported_at)?->toIso8601String(),
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
