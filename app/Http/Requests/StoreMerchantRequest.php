<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class StoreMerchantRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'legal_name' => ['nullable', 'string', 'max:255'],
            'billing_email' => ['nullable', 'email', 'max:255'],
            'support_email' => ['nullable', 'email', 'max:255'],
            'max_driver_distance' => ['nullable', 'numeric', 'min:0'],
            'delivery_offers_expiry_time' => ['nullable', 'integer', 'min:1'],
            'driver_offline_timeout_minutes' => ['nullable', 'integer', 'min:1'],
            'default_webhook_url' => ['nullable', 'url', 'max:2048'],
            'metadata' => ['nullable', 'array'],
        ];
    }
}
