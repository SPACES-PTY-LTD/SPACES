<?php

namespace App\Http\Requests;

class AssignShipmentDriverRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'driver_id' => ['required', 'uuid', 'exists:drivers,uuid'],
            'vehicle_id' => ['sometimes', 'nullable', 'uuid', 'exists:vehicles,uuid'],
        ];
    }
}
