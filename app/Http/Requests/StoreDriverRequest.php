<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class StoreDriverRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'telephone' => ['nullable', 'string', 'max:50'],
            'password' => ['required', 'string', 'min:6'],
            'carrier_id' => ['nullable', 'uuid', 'exists:carriers,uuid'],
            'vehicle_type_id' => ['nullable', 'uuid', 'exists:vehicle_types,uuid'],
            'is_active' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string'],
            'metadata' => ['sometimes', 'array'],
        ];
    }
}
