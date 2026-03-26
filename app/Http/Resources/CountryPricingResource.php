<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CountryPricingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'country_pricing_id' => $this->uuid,
            'country_name' => $this->country_name,
            'country_code' => $this->country_code,
            'currency' => $this->currency,
            'is_default' => (bool) $this->is_default,
            'payment_gateway' => $this->paymentGateway ? new PaymentGatewayResource($this->paymentGateway) : null,
        ];
    }
}
