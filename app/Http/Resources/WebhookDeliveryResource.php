<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebhookDeliveryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'webhook_delivery_id' => $this->uuid,
            'delivery_id' => $this->uuid,
            'merchant_id' => optional($this->merchant)->uuid,
            'subscription_id' => optional($this->subscription)->uuid,
            'event_type' => $this->event_type,
            'event' => $this->event_type,
            'status' => $this->status,
            'attempts' => $this->attempts,
            'last_attempt_at' => optional($this->last_attempt_at)?->toIso8601String(),
            'next_attempt_at' => optional($this->next_attempt_at)?->toIso8601String(),
            'last_response_code' => $this->last_response_code,
            'last_response_body' => $this->last_response_body,
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'createdAt' => optional($this->created_at)?->toIso8601String(),
        ];
    }
}
