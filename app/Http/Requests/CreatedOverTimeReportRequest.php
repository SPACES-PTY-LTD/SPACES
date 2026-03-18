<?php

namespace App\Http\Requests;

class CreatedOverTimeReportRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['nullable', 'uuid', 'exists:merchants,uuid'],
            'date_range' => ['nullable', 'string'],
        ];
    }
}
