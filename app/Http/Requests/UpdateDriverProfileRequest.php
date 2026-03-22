<?php

namespace App\Http\Requests;

class UpdateDriverProfileRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'telephone' => ['nullable', 'string', 'max:50'],
        ];
    }
}
