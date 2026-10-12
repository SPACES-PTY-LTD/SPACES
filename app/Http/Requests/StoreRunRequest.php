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
            'schedule_request_id' => ['required_if:schedule_managed,true', 'nullable', 'uuid'],
            'expected_source_run_id' => ['sometimes', 'nullable', 'uuid'],
            'schedule_managed' => ['sometimes', 'boolean'],
            'origin_location_id' => ['sometimes', 'nullable', 'uuid', 'exists:locations,uuid'],
            'destination_location_id' => ['sometimes', 'nullable', 'uuid', 'exists:locations,uuid'],
            'shipment_ids' => ['sometimes', 'array'],
            'shipment_ids.*' => ['uuid', 'distinct', 'exists:shipments,uuid'],
            'driver_id' => ['nullable', 'uuid', 'exists:drivers,uuid'],
            'vehicle_id' => ['nullable', 'uuid', 'exists:vehicles,uuid'],
            'route_id' => ['nullable', 'uuid', 'exists:routes,uuid'],
            'planned_start_at' => ['nullable', 'date'],
            'service_area' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
