<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountPaymentMethodResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'payment_method_id' => $this->uuid,
            'gateway_code' => $this->gateway_code,
            'brand' => $this->brand,
            'last_four' => $this->last_four,
            'expiry_month' => $this->expiry_month,
            'expiry_year' => $this->expiry_year,
            'funding_type' => $this->funding_type,
            'bank' => $this->bank,
            'signature' => $this->signature,
            'is_reusable' => (bool) $this->is_reusable,
            'retrieved_from_gateway' => (bool) $this->retrieved_from_gateway,
            'is_default' => (bool) $this->is_default,
            'status' => $this->status,
            'verified_at' => optional($this->verified_at)?->toIso8601String(),
            'payment_gateway' => $this->paymentGateway ? new PaymentGatewayResource($this->paymentGateway) : null,
            'gateway_customer_id' => $this->gateway_customer_id,
            'gateway_payment_method_id' => $this->gateway_payment_method_id,
            'gateway_reference' => $this->gateway_reference,
        ];
    }
}
