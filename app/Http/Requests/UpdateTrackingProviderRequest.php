<?php

namespace App\Http\Requests;

class UpdateTrackingProviderRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'status' => ['sometimes', 'in:active,disabled'],
            'logo_file_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'website' => ['sometimes', 'nullable', 'string', 'max:255'],
            'documentation' => ['sometimes', 'nullable', 'string', 'max:255'],
            'supports_bulk_vehicle_requests' => ['sometimes', 'boolean'],
            'default_tracking' => ['sometimes', 'boolean'],
            'has_location_services' => ['sometimes', 'boolean'],
            'has_driver_importing' => ['sometimes', 'boolean'],
            'has_locations_importing' => ['sometimes', 'boolean'],
            'has_vehicle_importing' => ['sometimes', 'boolean'],
        ];
    }
}
