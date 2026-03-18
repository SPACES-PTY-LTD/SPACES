<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RouteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'route_id' => $this->uuid,
            'merchant_id' => optional($this->merchant)->uuid,
            'environment_id' => optional($this->environment)->uuid,
            'title' => $this->title,
            'code' => $this->code,
            'description' => $this->description,
            'estimated_distance' => $this->estimated_distance !== null ? (float) $this->estimated_distance : null,
            'estimated_duration' => $this->estimated_duration,
            'estimated_collection_time' => $this->estimated_collection_time,
            'estimated_delivery_time' => $this->estimated_delivery_time,
            'auto_created' => (bool) $this->auto_created,
            'stops' => $this->whenLoaded('routeStops', function () {
                return $this->routeStops->map(function ($stop) {
                    return [
                        'stop_id' => $stop->uuid,
                        'sequence' => $stop->sequence,
                        'location' => $stop->location ? [
                            'location_id' => $stop->location->uuid,
                            'name' => $stop->location->name,
                            'company' => $stop->location->company,
                            'code' => $stop->location->code,
                            'location_type_id' => optional($stop->location->locationType)->uuid,
                            'location_type_slug' => optional($stop->location->locationType)->slug,
                            'full_address' => $stop->location->full_address,
                            'latitude' => $stop->location->latitude !== null ? (float) $stop->location->latitude : null,
                            'longitude' => $stop->location->longitude !== null ? (float) $stop->location->longitude : null,
                            'city' => $stop->location->city,
                            'province' => $stop->location->province,
                            'country' => $stop->location->country,
                        ] : null,
                    ];
                })->values();
            }),
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
