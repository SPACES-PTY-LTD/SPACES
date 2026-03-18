<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShipmentParcelResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'parcel_id' => $this->uuid,
            'parcel_code' => $this->parcel_code,
            'weight' => $this->weight,
            'weight_measurement' => $this->weight_measurement,
            'type' => $this->type,
            'length_cm' => $this->length_cm,
            'width_cm' => $this->width_cm,
            'height_cm' => $this->height_cm,
            'declared_value' => $this->declared_value,
            'contents_description' => $this->contents_description,
            'is_picked_up_scanned' => $this->picked_up_scanned_at !== null,
            'picked_up_scanned_at' => optional($this->picked_up_scanned_at)?->toIso8601String(),
            'picked_up_scanned_by_user_id' => optional($this->pickedUpScannedBy)->uuid,
        ];
    }
}
