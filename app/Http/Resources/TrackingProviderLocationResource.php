<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TrackingProviderLocationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'provider_location_id' => (string) ($this['provider_location_id'] ?? ''),
            'name' => $this['name'] ?? null,
            'code' => $this['code'] ?? null,
            'company' => $this['company'] ?? null,
            'full_address' => $this['full_address'] ?? null,
            'city' => $this['city'] ?? null,
            'province' => $this['province'] ?? null,
            'country' => $this['country'] ?? null,
            'latitude' => $this['latitude'] ?? null,
            'longitude' => $this['longitude'] ?? null,
            'has_geofence' => (bool) ($this['has_geofence'] ?? false),
        ];
    }
}
