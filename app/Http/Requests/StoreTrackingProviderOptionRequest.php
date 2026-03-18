<?php

namespace App\Http\Requests;

class StoreTrackingProviderOptionRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'label' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:text,select,boolean,password'],
            'options' => ['nullable', 'array', 'required_if:type,select'],
            'order_id' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
