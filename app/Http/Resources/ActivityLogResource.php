<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ActivityLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'activity_id' => $this->uuid,
            'account_id' => $this->account?->uuid,
            'merchant_id' => $this->merchant?->uuid,
            'environment_id' => $this->environment?->uuid,
            'actor_user_id' => $this->actor?->uuid,
            'actor_name' => $this->actor?->name,
            'action' => $this->action,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_uuid,
            'title' => $this->title,
            'changes' => $this->changes,
            'metadata' => $this->metadata,
            'request_id' => $this->request_id,
            'ip_address' => $this->ip_address,
            'occurred_at' => optional($this->occurred_at)?->toIso8601String(),
            'created_at' => optional($this->created_at)?->toIso8601String(),
        ];
    }
}
