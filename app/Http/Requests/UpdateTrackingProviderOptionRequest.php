<?php

namespace App\Http\Requests;

class UpdateTrackingProviderOptionRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'label' => ['sometimes', 'string', 'max:255'],
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', 'in:text,select,boolean,password'],
            'options' => ['nullable', 'array'],
            'order_id' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
