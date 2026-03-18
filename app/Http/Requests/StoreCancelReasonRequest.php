<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class StoreCancelReasonRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:50', 'unique:cancel_reasons,code'],
            'title' => ['required', 'string', 'max:255'],
            'enabled' => ['sometimes', 'boolean'],
        ];
    }
}
