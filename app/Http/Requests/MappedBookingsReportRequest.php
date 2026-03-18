<?php

namespace App\Http\Requests;

class MappedBookingsReportRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['nullable', 'uuid', 'exists:merchants,uuid'],
            'search' => ['nullable', 'string', 'max:120'],
        ];
    }
}
