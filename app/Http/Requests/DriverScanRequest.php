<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class DriverScanRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'parcel_code' => ['required', 'string', 'min:10', 'max:12', 'regex:/^[A-Z0-9]+$/'],
            'event_description' => ['nullable', 'string'],
            'occurred_at' => ['nullable', 'date'],
            'payload' => ['nullable', 'array'],
        ];
    }
}
