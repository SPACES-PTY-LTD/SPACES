<?php

namespace App\Http\Requests;

class ListLocationsRequest extends BaseRequest
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
            'location_type_id' => ['nullable', 'uuid', 'exists:location_types,uuid'],
            'tag_id' => ['nullable', 'uuid', 'exists:tags,uuid'],
            'code' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:255'],
            'search' => ['nullable', 'string', 'max:255'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'sort_by' => ['nullable', 'string', 'in:created_at,name,code,company,city,type'],
            'sort_dir' => ['nullable', 'string', 'in:asc,desc'],
        ];
    }
}
