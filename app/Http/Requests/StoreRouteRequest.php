<?php

namespace App\Http\Requests;

class StoreRouteRequest extends BaseRequest
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
            'title' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string'],
            'estimated_distance' => ['nullable', 'numeric', 'min:0'],
            'estimated_duration' => ['nullable', 'integer', 'min:0'],
            'estimated_collection_time' => ['nullable', 'integer', 'min:0'],
            'estimated_delivery_time' => ['nullable', 'integer', 'min:0'],
            'stops' => ['required', 'array', 'min:1'],
            'stops.*.location_id' => ['required', 'uuid', 'exists:locations,uuid'],
            'stops.*.sequence' => ['required', 'integer', 'min:1'],
        ];
    }
}
