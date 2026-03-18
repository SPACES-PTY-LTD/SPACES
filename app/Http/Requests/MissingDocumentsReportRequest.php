<?php

namespace App\Http\Requests;

use App\Models\FileType;

class MissingDocumentsReportRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['nullable', 'uuid', 'exists:merchants,uuid'],
            'entity_type' => ['nullable', 'string', 'in:' . implode(',', FileType::ENTITY_TYPES)],
            'sort_by' => ['nullable', 'string', 'in:merchant_name,entity_type,entity_label,file_type_name'],
            'sort_dir' => ['nullable', 'string', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
