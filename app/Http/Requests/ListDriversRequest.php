<?php

namespace App\Http\Requests;

class ListDriversRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['nullable', 'uuid', 'exists:merchants,uuid'],
            'is_active' => ['nullable', 'boolean'],
            'has_vehicle' => ['nullable', 'boolean'],
            'source' => ['nullable', 'string', 'in:imported,manual'],
            'search' => ['nullable', 'string', 'max:255'],
            'sort_by' => ['nullable', 'string', 'in:created_at,name,email,telephone,intergration_id,is_active,imported_at,vehicles'],
            'sort_direction' => ['nullable', 'string', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
