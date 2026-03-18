<?php

namespace App\Http\Requests;

use App\Models\FileType;

class UpdateFileTypeRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'requires_expiry' => ['sometimes', 'boolean'],
            'driver_can_upload' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'entity_type' => ['sometimes', 'in:'.implode(',', FileType::ENTITY_TYPES)],
        ];
    }
}
