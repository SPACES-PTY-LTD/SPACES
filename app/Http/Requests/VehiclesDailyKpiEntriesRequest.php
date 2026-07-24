<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class VehiclesDailyKpiEntriesRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['nullable', 'uuid', 'exists:merchants,uuid'],
            'vehicle_id' => ['required', 'uuid', 'exists:vehicles,uuid'],
            'year' => ['required', 'integer', 'min:2000', 'max:9999'],
            'month' => ['required', 'integer', 'between:1,12'],
            'day' => ['required', 'integer', 'between:1,31'],
            'metric' => ['required', 'string', Rule::in([
                'speed_violations',
                'runs',
                'shipments',
                'total_stops',
                'unknown_location_stops',
                'invoiced_shipments',
            ])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
