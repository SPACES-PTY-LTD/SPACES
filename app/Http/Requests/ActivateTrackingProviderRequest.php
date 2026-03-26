<?php

namespace App\Http\Requests;

class ActivateTrackingProviderRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'provider_id' => ['required', 'uuid', 'exists:tracking_providers,uuid'],
            'merchant_id' => ['nullable', 'uuid', 'exists:merchants,uuid'],
            'integration_data' => ['required', 'array'],
        ];
    }
}
