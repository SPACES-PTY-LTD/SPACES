<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class RefreshTokenRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'refresh_token' => ['required', 'string'],
        ];
    }
}
