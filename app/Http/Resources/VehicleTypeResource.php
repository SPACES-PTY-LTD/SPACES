<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VehicleTypeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'vehicle_type_id' => $this->uuid,
            'code' => $this->code,
            'name' => $this->name,
            'enabled' => (bool) $this->enabled,
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
