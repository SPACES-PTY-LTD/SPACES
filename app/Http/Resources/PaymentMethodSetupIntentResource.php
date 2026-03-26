<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentMethodSetupIntentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'gateway_code' => $this['gateway_code'] ?? null,
            'hosted_capture_supported' => (bool) ($this['hosted_capture_supported'] ?? false),
            'mode' => $this['mode'] ?? null,
            'publishable_key' => $this['publishable_key'] ?? null,
            'client_secret' => $this['client_secret'] ?? null,
            'redirect_url' => $this['redirect_url'] ?? null,
            'metadata' => $this['metadata'] ?? [],
        ];
    }
}
