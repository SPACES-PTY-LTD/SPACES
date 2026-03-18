<?php

namespace App\Http\Requests;

use App\Models\FileType;

class StoreFileTypeRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['required', 'uuid', 'exists:merchants,uuid'],
            'entity_type' => ['required', 'in:'.implode(',', FileType::ENTITY_TYPES)],
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'requires_expiry' => ['nullable', 'boolean'],
            'driver_can_upload' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
