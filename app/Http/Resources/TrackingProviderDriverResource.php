<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TrackingProviderDriverResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'provider_driver_id' => (string) ($this['provider_driver_id'] ?? ''),
            'name' => $this['name'] ?? null,
            'email' => $this['email'] ?? null,
            'telephone' => $this['telephone'] ?? null,
            'employee_number' => $this['employee_number'] ?? null,
            'is_active' => $this['is_active'] ?? null,
            'notes' => $this['notes'] ?? null,
        ];
    }
}
