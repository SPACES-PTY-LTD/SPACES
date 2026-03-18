<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FileTypeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'file_type_id' => $this->uuid,
            'merchant_id' => $this->merchant?->uuid,
            'entity_type' => $this->entity_type,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'requires_expiry' => (bool) $this->requires_expiry,
            'driver_can_upload' => (bool) $this->driver_can_upload,
            'is_active' => (bool) $this->is_active,
            'sort_order' => (int) $this->sort_order,
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
