<?php

namespace App\Http\Requests;

class UpdateWebhookSubscriptionRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'url' => ['sometimes', 'required', 'url', 'max:2048'],
            'event_types' => ['sometimes', 'required', 'array', 'min:1'],
            'event_types.*' => ['string', 'max:100'],
        ];
    }
}
