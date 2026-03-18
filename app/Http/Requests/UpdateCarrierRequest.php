<?php

namespace App\Http\Requests;

use App\Models\Carrier;
use App\Http\Requests\BaseRequest;

class UpdateCarrierRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $carrierId = Carrier::where('uuid', $this->route('carrier_uuid'))->value('id');

        return [
            'code' => ['sometimes', 'string', 'max:50', 'unique:carriers,code,'.$carrierId],
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', 'in:internal,external'],
            'enabled' => ['sometimes', 'boolean'],
            'settings' => ['sometimes', 'array'],
        ];
    }
}
