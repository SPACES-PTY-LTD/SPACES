<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class UpdateDriverVehicleRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'vehicle_id' => ['required', 'uuid', 'exists:vehicles,uuid'],
        ];
    }
}
