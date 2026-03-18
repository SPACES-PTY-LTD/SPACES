<?php

namespace App\Http\Requests;

class UpdateRouteRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'code' => ['sometimes', 'required', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string'],
            'estimated_distance' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'estimated_duration' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'estimated_collection_time' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'estimated_delivery_time' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'stops' => ['sometimes', 'required', 'array', 'min:1'],
            'stops.*.location_id' => ['required_with:stops', 'uuid', 'exists:locations,uuid'],
            'stops.*.sequence' => ['required_with:stops', 'integer', 'min:1'],
        ];
    }
}
