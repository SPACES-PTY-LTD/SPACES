<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LocationTypeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'location_type_id' => $this->uuid,
            'slug' => $this->slug,
            'title' => $this->title,
            'collection_point' => (bool) $this->collection_point,
            'delivery_point' => (bool) $this->delivery_point,
            'sequence' => (int) $this->sequence,
            'icon' => $this->icon,
            'color' => $this->color,
            'default' => (bool) $this->default,
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
