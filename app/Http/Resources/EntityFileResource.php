<?php

namespace App\Http\Resources;

use App\Models\Driver;
use App\Models\Shipment;
use App\Models\Vehicle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EntityFileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'file_id' => $this->uuid,
            'merchant_id' => $this->merchant?->uuid,
            'entity_type' => $this->fileType?->entity_type,
            'entity_id' => $this->attachable?->uuid,
            'entity_label' => $this->resolveEntityLabel(),
            'file_type' => $this->fileType ? new FileTypeResource($this->fileType) : null,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size_bytes' => (int) $this->size_bytes,
            'expires_at' => optional($this->expires_at)?->toIso8601String(),
            'is_expired' => $this->expires_at ? $this->expires_at->isPast() : false,
            'uploaded_by_role' => $this->uploaded_by_role,
            'uploaded_by_user' => $this->uploadedBy ? [
                'user_id' => $this->uploadedBy->uuid,
                'name' => $this->uploadedBy->name,
                'email' => $this->uploadedBy->email,
                'role' => $this->uploadedBy->role,
            ] : null,
            'download_url' => "/api/v1/files/{$this->uuid}/download",
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }

    private function resolveEntityLabel(): string
    {
        $attachable = $this->attachable;

        if ($attachable instanceof Shipment) {
            return $attachable->merchant_order_ref
                ?: $attachable->delivery_note_number
                ?: $attachable->invoice_number
                ?: $attachable->uuid;
        }

        if ($attachable instanceof Driver) {
            return $attachable->user?->name ?: $attachable->uuid;
        }

        if ($attachable instanceof Vehicle) {
            return $attachable->plate_number
                ?: $attachable->ref_code
                ?: trim(implode(' ', array_filter([$attachable->make, $attachable->model])))
                ?: $attachable->uuid;
        }

        return $this->uuid;
    }
}
