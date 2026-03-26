<?php

namespace App\Http\Requests;

class StoreAccountPaymentMethodRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'payment_gateway_id' => ['nullable', 'uuid', 'exists:payment_gateways,uuid'],
            'gateway_customer_id' => ['nullable', 'string', 'max:255'],
            'gateway_payment_method_id' => ['nullable', 'string', 'max:255'],
            'gateway_reference' => ['nullable', 'string', 'max:255'],
            'brand' => ['nullable', 'string', 'max:100'],
            'last_four' => ['nullable', 'string', 'size:4'],
            'expiry_month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'expiry_year' => ['nullable', 'integer', 'min:2024', 'max:2100'],
            'funding_type' => ['nullable', 'string', 'max:100'],
            'bank' => ['nullable', 'string', 'max:255'],
            'signature' => ['nullable', 'string', 'max:255'],
            'is_reusable' => ['nullable', 'boolean'],
            'retrieved_from_gateway' => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'status' => ['nullable', 'string', 'in:active,inactive,expired'],
            'gateway_metadata' => ['nullable', 'array'],
        ];
    }
}
