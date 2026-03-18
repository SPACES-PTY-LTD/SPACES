<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class AssignDriverRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'driver_id' => ['required', 'uuid', 'exists:drivers,uuid'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
