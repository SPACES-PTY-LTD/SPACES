<?php

namespace App\Http\Requests;

class ImportDriversRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['required', 'uuid', 'exists:merchants,uuid'],
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:20480'],
        ];
    }
}
