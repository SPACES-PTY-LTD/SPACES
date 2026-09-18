<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class DriverStatusUpdateRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'in:in_transit,delivered,failed'],
            'note' => ['required_if:status,failed', 'nullable', 'string', 'max:2000'],
            'odometer_at_collection' => ['nullable', 'integer', 'min:0'],
            'odometer_at_delivery' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
