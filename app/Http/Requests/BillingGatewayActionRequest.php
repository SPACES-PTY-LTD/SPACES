<?php

namespace App\Http\Requests;

class BillingGatewayActionRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'payment_gateway_id' => ['nullable', 'uuid', 'exists:payment_gateways,uuid'],
        ];
    }
}
