<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountInvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'invoice_id' => $this->uuid,
            'invoice_number' => $this->invoice_number,
            'billing_period_start' => optional($this->billing_period_start)?->toDateString(),
            'billing_period_end' => optional($this->billing_period_end)?->toDateString(),
            'currency' => $this->currency,
            'subtotal' => (float) $this->subtotal,
            'total' => (float) $this->total,
            'invoice_status' => $this->invoice_status,
            'payment_status' => $this->payment_status,
            'gateway_code' => $this->gateway_code,
            'due_date' => optional($this->due_date)?->toDateString(),
            'paid_at' => optional($this->paid_at)?->toIso8601String(),
            'last_payment_attempt_at' => optional($this->last_payment_attempt_at)?->toIso8601String(),
            'failure_reason' => $this->failure_reason,
            'lines' => AccountInvoiceLineResource::collection($this->whenLoaded('lines')),
            'payment_attempts' => AccountInvoicePaymentAttemptResource::collection($this->whenLoaded('paymentAttempts')),
        ];
    }
}
