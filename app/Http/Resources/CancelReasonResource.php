<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CancelReasonResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'cancel_reason_id' => $this->uuid,
            'code' => $this->code,
            'title' => $this->title,
            'enabled' => (bool) $this->enabled,
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
