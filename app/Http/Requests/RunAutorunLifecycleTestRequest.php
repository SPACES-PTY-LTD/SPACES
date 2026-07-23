<?php

namespace App\Http\Requests;

class RunAutorunLifecycleTestRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->role, ['user', 'super_admin'], true);
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['required', 'uuid', 'exists:merchants,uuid'],
            'vehicle_id' => ['required', 'uuid', 'exists:vehicles,uuid'],
            'location_id' => ['required', 'uuid', 'exists:locations,uuid'],
            'action' => ['required', 'string', 'in:enter,exit'],
        ];
    }
}
