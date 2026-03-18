<?php

namespace App\Http\Requests;

class SyncLocationTypesRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['required', 'uuid', 'exists:merchants,uuid'],
            'types' => ['required', 'array', 'min:1'],
            'types.*.location_type_id' => ['nullable', 'uuid'],
            'types.*.slug' => ['nullable', 'string', 'max:100', 'distinct'],
            'types.*.title' => ['required', 'string', 'max:255'],
            'types.*.collection_point' => ['sometimes', 'boolean'],
            'types.*.delivery_point' => ['sometimes', 'boolean'],
            'types.*.sequence' => ['sometimes', 'integer', 'min:0'],
            'types.*.icon' => ['nullable', 'string', 'max:255'],
            'types.*.color' => ['nullable', 'string', 'max:32'],
            'types.*.default' => ['sometimes', 'boolean'],
        ];
    }
}
