<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentMethodSyncResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'gateway_code' => $this['gateway_code'] ?? null,
            'supports_card_retrieval' => (bool) ($this['supports_card_retrieval'] ?? false),
            'supports_hosted_card_capture' => (bool) ($this['supports_hosted_card_capture'] ?? false),
            'retrieved_from_gateway' => (bool) ($this['retrieved_from_gateway'] ?? false),
            'cards' => $this['cards'] ?? [],
        ];
    }
}
