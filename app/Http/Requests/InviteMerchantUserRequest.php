<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;
use App\Support\MerchantAccess;

class InviteMerchantUserRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email'],
            'role' => ['required', 'in:'.implode(',', array_merge(MerchantAccess::ASSIGNABLE_ROLES, MerchantAccess::LEGACY_ASSIGNABLE_ROLES))],
        ];
    }
}
