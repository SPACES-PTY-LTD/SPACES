<?php

namespace App\Http\Requests;

class StoreRunRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['required', 'string'],
            'environment_id' => ['nullable', 'string'],
            'driver_id' => ['nullable', 'uuid', 'exists:drivers,uuid'],
            'vehicle_id' => ['nullable', 'uuid', 'exists:vehicles,uuid'],
            'route_id' => ['nullable', 'uuid', 'exists:routes,uuid'],
            'planned_start_at' => ['nullable', 'date'],
            'service_area' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
