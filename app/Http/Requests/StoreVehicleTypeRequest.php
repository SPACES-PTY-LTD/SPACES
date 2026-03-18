<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class StoreVehicleTypeRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:50', 'unique:vehicle_types,code'],
            'name' => ['required', 'string', 'max:255'],
            'enabled' => ['sometimes', 'boolean'],
        ];
    }
}
