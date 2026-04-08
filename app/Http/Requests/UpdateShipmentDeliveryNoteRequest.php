<?php

namespace App\Http\Requests;

class UpdateShipmentDeliveryNoteRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'delivery_note_number' => ['required', 'string', 'max:120'],
        ];
    }
}
