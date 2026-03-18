<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdateVehicleMaintenanceRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isMaintenanceMode = filter_var($this->input('maintenance_mode'), FILTER_VALIDATE_BOOLEAN);

        return [
            'maintenance_mode' => ['required', 'boolean'],
            'maintenance_expected_resolved_at' => [
                Rule::requiredIf($isMaintenanceMode),
                'nullable',
                'date',
                'after_or_equal:today',
            ],
            'maintenance_description' => [
                Rule::requiredIf($isMaintenanceMode),
                'nullable',
                'string',
                'max:5000',
            ],
        ];
    }
}
