<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class AcceptMerchantInviteRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'token' => ['required', 'string'],
            'name' => ['sometimes', 'string', 'max:255'],
            'password' => ['sometimes', 'string', 'min:8', 'confirmed'],
        ];
    }
}
