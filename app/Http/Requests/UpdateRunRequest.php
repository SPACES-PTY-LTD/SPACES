<?php

namespace App\Http\Requests;

class UpdateRunRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'origin_location_id' => ['sometimes', 'nullable', 'uuid', 'exists:locations,uuid'],
            'destination_location_id' => ['sometimes', 'nullable', 'uuid', 'exists:locations,uuid'],
            'expected_driver_id' => ['sometimes', 'nullable', 'uuid'],
            'driver_id' => ['sometimes', 'nullable', 'uuid', 'exists:drivers,uuid'],
            'vehicle_id' => ['sometimes', 'nullable', 'uuid', 'exists:vehicles,uuid'],
            'route_id' => ['sometimes', 'nullable', 'uuid', 'exists:routes,uuid'],
            'planned_start_at' => ['sometimes', 'nullable', 'date'],
            'service_area' => ['sometimes', 'nullable', 'string', 'max:255'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ];
    }
}
