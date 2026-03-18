<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class StoreCarrierRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $user = $this->user();
        $isMerchant = $user && $user->role === 'user';

        return [
            'code' => [$isMerchant ? 'nullable' : 'required', 'string', 'max:50', 'unique:carriers,code'],
            'name' => [$isMerchant ? 'nullable' : 'required', 'string', 'max:255'],
            'type' => [$isMerchant ? 'nullable' : 'required', 'in:internal,external'],
            'enabled' => ['sometimes', 'boolean'],
            'settings' => ['sometimes', 'array'],
        ];
    }
}
