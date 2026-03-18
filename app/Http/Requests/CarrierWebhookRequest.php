<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class CarrierWebhookRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'payload' => ['sometimes', 'array'],
        ];
    }
}
