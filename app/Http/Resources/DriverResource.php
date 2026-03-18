<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Http\Resources\VehicleResource;

class DriverResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'driver_id' => $this->uuid,
            'merchant_id' => $this->merchant?->uuid,
            'name' => $this->user->name,
            'email' => $this->user->email,
            'telephone' => $this->user?->telephone,
            'intergration_id' => $this->intergration_id,
            'carrier' => $this->carrier ? new CarrierResource($this->carrier) : null,
            'vehicles' => VehicleResource::collection($this->vehicles),
            'is_active' => (bool) $this->is_active,
            'notes' => $this->notes,
            'metadata' => $this->metadata,
            'imported_at' => optional($this->imported_at)?->toIso8601String(),
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
