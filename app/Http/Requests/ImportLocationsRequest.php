<?php

namespace App\Http\Requests;

class ImportLocationsRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['required', 'uuid', 'exists:merchants,uuid'],
            'environment_id' => ['nullable', 'uuid', 'exists:merchant_environments,uuid'],
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:20480'],
        ];
    }
}
