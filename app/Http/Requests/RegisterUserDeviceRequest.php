<?php

namespace App\Http\Requests;

class RegisterUserDeviceRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'platform' => ['required', 'string', 'max:40'],
            'push_provider' => ['nullable', 'string', 'max:60'],
            'push_token' => ['nullable', 'string', 'max:255'],
            'device_name' => ['nullable', 'string', 'max:255'],
            'app_version' => ['nullable', 'string', 'max:60'],
        ];
    }
}
