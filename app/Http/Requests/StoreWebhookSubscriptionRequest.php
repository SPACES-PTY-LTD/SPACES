<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class StoreWebhookSubscriptionRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['required', 'string'],
            'url' => ['required', 'url', 'max:2048'],
            'event_types' => ['required', 'array', 'min:1'],
            'event_types.*' => ['string', 'max:100'],
        ];
    }
}
