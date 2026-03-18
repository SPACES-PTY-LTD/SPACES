<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingPodResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'pod_id' => $this->uuid,
            'booking_id' => optional($this->booking)->uuid,
            'file_key' => $this->file_key,
            'file_type' => $this->file_type,
            'signed_by' => $this->signed_by,
            'captured_by_user_id' => optional($this->capturedBy)->uuid,
            'metadata' => $this->metadata,
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
