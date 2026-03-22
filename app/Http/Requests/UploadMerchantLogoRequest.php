<?php

namespace App\Http\Requests;

class UploadMerchantLogoRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'logo' => ['required', 'file', 'image', 'max:5120'],
        ];
    }
}
