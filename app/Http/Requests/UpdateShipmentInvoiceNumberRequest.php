<?php

namespace App\Http\Requests;

class UpdateShipmentInvoiceNumberRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'invoice_number' => ['required', 'string', 'max:120'],
        ];
    }
}
