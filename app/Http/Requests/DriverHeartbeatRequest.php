<?php

namespace App\Http\Requests;

class DriverHeartbeatRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'is_online' => ['required', 'boolean'],
            'is_available' => ['nullable', 'boolean'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'platform' => ['nullable', 'string', 'max:40'],
            'push_provider' => ['nullable', 'string', 'max:60'],
            'push_token' => ['nullable', 'string', 'max:255'],
            'device_name' => ['nullable', 'string', 'max:255'],
            'app_version' => ['nullable', 'string', 'max:60'],
            'user_device_id' => ['nullable', 'uuid'],
        ];
    }
}
