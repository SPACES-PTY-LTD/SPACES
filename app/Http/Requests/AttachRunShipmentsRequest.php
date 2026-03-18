<?php

namespace App\Http\Requests;

class AttachRunShipmentsRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'shipment_ids' => ['required', 'array', 'min:1'],
            'shipment_ids.*' => ['required', 'uuid', 'exists:shipments,uuid'],
        ];
    }
}
