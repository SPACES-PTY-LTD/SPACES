<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeliveryNoteImportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'import_id' => $this->uuid,
            'run_id' => $this->run?->uuid,
            'status' => $this->status,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size_bytes' => (int) $this->size_bytes,
            'download_url' => "/api/v1/runs/{$this->run?->uuid}/delivery-note-imports/{$this->uuid}/download",
            'model' => $this->model,
            'grouping_mode' => 'separate_shipments',
            'extracted_data' => $this->when($this->status === 'analyzed', $this->extracted_data),
            'shipment_ids' => $this->whenLoaded('shipments', fn () => $this->shipments->pluck('uuid')->values()->all()),
            'confirmed_at' => optional($this->confirmed_at)?->toIso8601String(),
            'created_at' => optional($this->created_at)?->toIso8601String(),
        ];
    }
}
