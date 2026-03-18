<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class DriverPodRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file_key' => ['required', 'string', 'max:255'],
            'file_type' => ['nullable', 'string', 'max:50'],
            'signed_by' => ['nullable', 'string', 'max:255'],
            'metadata' => ['nullable', 'array'],
        ];
    }
}
