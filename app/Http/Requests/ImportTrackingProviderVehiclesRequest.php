<?php

namespace App\Http\Requests;

class ImportTrackingProviderVehiclesRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['required', 'uuid', 'exists:merchants,uuid'],
            'vehicles' => ['required', 'array', 'min:1'],
            'vehicles.*.provider_vehicle_id' => ['required', 'string'],
            'vehicles.*.vehicle_type_id' => ['required', 'string'],
        ];
    }
}
