<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DriverVehicleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $vehicle = $this->vehicle;

        return [
            'vehicle_id' => optional($vehicle)->uuid,
            'driver_id' => optional($this->driver)->uuid,
            'vehicle_type_id' => optional($vehicle?->vehicleType)->uuid,
            'make' => $vehicle?->make,
            'model' => $vehicle?->model,
            'color' => $vehicle?->color,
            'plate_number' => $vehicle?->plate_number,
            'vin_number' => $vehicle?->vin_number,
            'engine_number' => $vehicle?->engine_number,
            'ref_code' => $vehicle?->ref_code,
            'odometer' => $vehicle?->odometer,
            'year' => $vehicle?->year,
            'last_location_address' => $vehicle?->last_location_address,
            'location_updated_at' => optional($vehicle?->location_updated_at)?->toIso8601String(),
            'intergration_id' => $vehicle?->intergration_id,
            'photo_key' => $vehicle?->photo_key,
            'is_active' => (bool) ($vehicle?->is_active ?? false),
            'metadata' => $vehicle?->metadata,
            'created_at' => optional($vehicle?->created_at)?->toIso8601String(),
            'updated_at' => optional($vehicle?->updated_at)?->toIso8601String(),
        ];
    }
}
