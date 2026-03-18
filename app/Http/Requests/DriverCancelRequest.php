<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class DriverCancelRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reason_code' => ['required', 'string', 'max:50', 'exists:cancel_reasons,code'],
            'reason' => ['nullable', 'string'],
            'note' => ['nullable', 'string'],
        ];
    }
}
