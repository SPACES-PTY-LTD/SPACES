<?php

namespace App\Http\Requests;

use App\Models\VehicleType;
use App\Http\Requests\BaseRequest;

class UpdateVehicleTypeRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $typeId = VehicleType::where('uuid', $this->route('vehicle_type_uuid'))->value('id');

        return [
            'code' => ['sometimes', 'string', 'max:50', 'unique:vehicle_types,code,'.$typeId],
            'name' => ['sometimes', 'string', 'max:255'],
            'enabled' => ['sometimes', 'boolean'],
        ];
    }
}
