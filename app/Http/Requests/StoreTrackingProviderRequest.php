<?php

namespace App\Http\Requests;

class StoreTrackingProviderRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,disabled'],
            'logo_file_name' => ['nullable', 'string', 'max:255'],
            'website' => ['nullable', 'string', 'max:255'],
            'documentation' => ['nullable', 'string', 'max:255'],
            'supports_bulk_vehicle_requests' => ['nullable', 'boolean'],
            'default_tracking' => ['nullable', 'boolean'],
            'has_driver_importing' => ['nullable', 'boolean'],
            'has_locations_importing' => ['nullable', 'boolean'],
            'has_vehicle_importing' => ['nullable', 'boolean'],
        ];
    }
}
