<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class ShipmentsByLocationReportRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['nullable', 'uuid', 'exists:merchants,uuid'],
            'date_range' => [
                'nullable',
                'string',
                Rule::in([
                    'today',
                    'yesterday',
                    'thisweek',
                    '1week',
                    '2weeks',
                    '30days',
                    '1month',
                    '3months',
                    '6months',
                    '1year',
                    'alltime',
                    'custom',
                ]),
            ],
            'location_type' => ['nullable', 'string', Rule::in(['pickup', 'dropoff'])],
            'start_date' => ['nullable', 'date_format:Y-m-d', 'required_if:date_range,custom'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'required_if:date_range,custom', 'after_or_equal:start_date'],
        ];
    }
}
