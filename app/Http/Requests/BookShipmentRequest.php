<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class BookShipmentRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'quote_option_id' => ['required', 'string'],
            'pickup_ready_at' => ['nullable', 'date'],
        ];
    }
}
