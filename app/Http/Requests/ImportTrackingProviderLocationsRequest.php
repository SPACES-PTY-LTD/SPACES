<?php

namespace App\Http\Requests;

class ImportTrackingProviderLocationsRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['required', 'uuid', 'exists:merchants,uuid'],
            'only_with_geofences' => ['sometimes', 'boolean'],
            'locations' => ['nullable', 'array', 'min:1'],
            'locations.*.provider_location_id' => ['required_with:locations', 'string'],
        ];
    }
}
