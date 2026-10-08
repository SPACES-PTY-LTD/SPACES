<?php

namespace App\Http\Requests;

class UpdateDriverPasswordRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['sometimes', 'nullable', 'uuid'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ];
    }
}
