<?php

namespace App\Http\Requests;

class UpdateVehicleRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['nullable', 'uuid', 'exists:merchants,uuid'],
            'vehicle_type_id' => ['nullable', 'uuid', 'exists:vehicle_types,uuid'],
            'make' => ['nullable', 'string', 'max:100'],
            'model' => ['nullable', 'string', 'max:100'],
            'color' => ['nullable', 'string', 'max:50'],
            'plate_number' => ['nullable', 'string', 'max:50'],
            'vin_number' => ['nullable', 'string', 'max:100'],
            'engine_number' => ['nullable', 'string', 'max:100'],
            'ref_code' => ['nullable', 'string', 'max:100'],
            'odometer' => ['nullable', 'integer', 'min:0'],
            'year' => ['nullable', 'integer', 'between:1900,2100'],
            'last_location_address' => ['nullable', 'array'],
            'location_updated_at' => ['nullable', 'date'],
            'intergration_id' => ['nullable', 'string', 'max:100'],
            'photo_key' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'metadata' => ['sometimes', 'array'],
        ];
    }
}
