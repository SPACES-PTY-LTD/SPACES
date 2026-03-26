<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountInvoicePaymentAttemptResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'payment_attempt_id' => $this->uuid,
            'gateway_code' => $this->gateway_code,
            'status' => $this->status,
            'amount' => (float) $this->amount,
            'provider_transaction_id' => $this->provider_transaction_id,
            'provider_reference' => $this->provider_reference,
            'failure_reason' => $this->failure_reason,
            'processed_at' => optional($this->processed_at)?->toIso8601String(),
        ];
    }
}
