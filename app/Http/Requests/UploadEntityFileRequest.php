<?php

namespace App\Http\Requests;

class UploadEntityFileRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['nullable', 'uuid', 'exists:merchants,uuid'],
            'file_type_id' => ['required', 'uuid', 'exists:file_types,uuid'],
            'file' => ['required', 'file', 'max:20480'],
            'expires_at' => ['nullable', 'date'],
        ];
    }
}
