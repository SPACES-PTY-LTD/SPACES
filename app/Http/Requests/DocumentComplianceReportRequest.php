<?php

namespace App\Http\Requests;

use App\Models\FileType;

class DocumentComplianceReportRequest extends BaseRequest
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
            'status' => ['nullable', 'string', 'in:expired,expiring'],
            'expiring_in_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'sort_by' => ['nullable', 'string', 'in:merchant_name,entity_type,entity_label,file_type_name,original_name,uploaded_at,expires_at,days_to_expiry,required_count,uploaded_count,missing_count,expired_count,compliance_percent'],
            'sort_dir' => ['nullable', 'string', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
