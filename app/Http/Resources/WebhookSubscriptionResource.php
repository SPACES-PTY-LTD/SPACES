<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebhookSubscriptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'subscription_id' => $this->uuid,
            'merchant_id' => optional($this->merchant)->uuid,
            'url' => $this->url,
            'event_types' => $this->event_types,
            'status' => $this->status,
            'created_at' => optional($this->created_at)?->toIso8601String(),
        ];
    }
}
