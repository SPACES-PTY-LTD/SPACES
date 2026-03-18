<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DriverAssignmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'driver_assignment_id' => $this->uuid,
            'booking_id' => optional($this->booking)->uuid,
            'driver_id' => optional($this->driver)->uuid,
            'assigned_by_user_id' => optional($this->assignedBy)->uuid,
            'assigned_at' => optional($this->assigned_at)?->toIso8601String(),
            'unassigned_at' => optional($this->unassigned_at)?->toIso8601String(),
            'notes' => $this->notes,
        ];
    }
}
