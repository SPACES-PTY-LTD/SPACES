<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class UpdateMerchantEnvironmentRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'color' => ['sometimes', 'string', 'max:32'],
            'url' => ['sometimes', 'url', 'max:2048'],
        ];
    }
}
