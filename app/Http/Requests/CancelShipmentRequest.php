<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class CancelShipmentRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reason_code' => ['required', 'string', 'max:100'],
            'reason_note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
