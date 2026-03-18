<?php

namespace App\Http\Requests;

class ListRoutesRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['nullable', 'uuid', 'exists:merchants,uuid'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'search' => ['nullable', 'string'],
            'code' => ['nullable', 'string'],
            'title' => ['nullable', 'string'],
            'sort_by' => ['nullable', 'string', 'in:created_at,updated_at,title,code,estimated_distance,estimated_duration'],
            'sort_dir' => ['nullable', 'string', 'in:asc,desc'],
        ];
    }
}
