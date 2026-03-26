<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TrackingProviderVehicleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'provider_vehicle_id' => (string) ($this['provider_vehicle_id'] ?? ''),
            'plate_number' => $this['plate_number'] ?? null,
            'description' => $this['description'] ?? null,
            'make' => $this['make'] ?? null,
            'model' => $this['model'] ?? null,
        ];
    }
}
