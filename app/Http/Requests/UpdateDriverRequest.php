<?php

namespace App\Http\Requests;

use App\Models\Driver;
use App\Http\Requests\BaseRequest;

class UpdateDriverRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $userId = Driver::where('uuid', $this->route('driver_uuid'))->value('user_id');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', 'unique:users,email,'.$userId],
            'telephone' => ['nullable', 'string', 'max:50'],
            'password' => ['nullable', 'string', 'min:6'],
            'carrier_id' => ['nullable', 'uuid', 'exists:carriers,uuid'],
            'vehicle_type_id' => ['nullable', 'uuid', 'exists:vehicle_types,uuid'],
            'is_active' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string'],
            'metadata' => ['sometimes', 'array'],
        ];
    }
}
