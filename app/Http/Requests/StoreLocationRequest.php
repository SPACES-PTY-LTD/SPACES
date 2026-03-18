<?php

namespace App\Http\Requests;

class StoreLocationRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['required', 'uuid', 'exists:merchants,uuid'],
            'environment_id' => ['nullable', 'uuid', 'exists:merchant_environments,uuid'],
            'name' => ['nullable', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:100'],
            'company' => ['nullable', 'string', 'max:255'],
            'full_address' => ['nullable', 'string', 'max:255'],
            'address_line_1' => ['required', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'town' => ['nullable', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'country' => ['nullable', 'string', 'max:100'],
            'first_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'province' => ['required', 'string', 'max:255'],
            'post_code' => ['required', 'string', 'max:20'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'polygon_bounds' => ['nullable', 'array', 'min:3'],
            'polygon_bounds.*' => ['array', 'size:2'],
            'polygon_bounds.*.0' => ['numeric'],
            'polygon_bounds.*.1' => ['numeric'],
            'google_place_id' => ['nullable', 'string', 'max:255'],
            'location_type_id' => ['nullable', 'uuid', 'exists:location_types,uuid'],
            'metadata' => ['sometimes', 'array'],
        ];
    }
}
