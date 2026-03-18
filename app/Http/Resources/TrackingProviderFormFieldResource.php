<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TrackingProviderFormFieldResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'field_id' => $this->uuid,
            'provider_id' => $this->provider?->uuid,
            'label' => $this->label,
            'name' => $this->name,
            'type' => $this->type,
            'is_required' => (bool) $this->is_required,
            'options' => $this->options,
            'order_id' => $this->order_id,
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
