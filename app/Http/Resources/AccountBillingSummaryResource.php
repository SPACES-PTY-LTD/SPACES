<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountBillingSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'account_id' => $this['account_id'],
            'owner' => $this['owner'],
            'country_code' => $this['country_code'],
            'is_billing_exempt' => (bool) $this['is_billing_exempt'],
            'currency' => $this['currency'],
            'current_billing_period_start' => $this['current_billing_period_start'] ?? null,
            'current_billing_period_end' => $this['current_billing_period_end'] ?? null,
            'next_billing_date' => $this['next_billing_date'] ?? null,
            'can_select_free_plan' => (bool) ($this['can_select_free_plan'] ?? false),
            'free_plan_available_until' => $this['free_plan_available_until'] ?? null,
            'current_invoice_preview' => $this['current_invoice_preview'] ?? null,
            'gateway' => $this['gateway'],
            'gateway_capabilities' => $this['gateway_capabilities'] ?? [
                'supports_card_retrieval' => false,
                'supports_hosted_card_capture' => false,
            ],
            'billing_profile' => $this['billing_profile'],
            'payment_methods' => AccountPaymentMethodResource::collection(collect($this['payment_methods'])),
            'merchants' => $this['merchants'],
            'invoices' => AccountInvoiceResource::collection(collect($this['invoices'])),
        ];
    }
}
