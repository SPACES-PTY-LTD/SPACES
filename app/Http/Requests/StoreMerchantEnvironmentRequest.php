<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class StoreMerchantEnvironmentRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'color' => ['sometimes', 'string', 'max:32'],
            'url' => ['sometimes', 'url', 'max:2048'],
        ];
    }
}
