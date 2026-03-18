<?php

namespace App\Http\Requests;

class ListActivityLogsRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'account_id' => ['nullable', 'uuid', 'exists:accounts,uuid'],
            'merchant_id' => ['nullable', 'uuid', 'exists:merchants,uuid'],
            'environment_id' => ['nullable', 'uuid', 'exists:merchant_environments,uuid'],
            'actor_user_id' => ['nullable', 'uuid', 'exists:users,uuid'],
            'action' => ['nullable', 'string', 'max:50'],
            'entity_type' => ['nullable', 'string', 'max:50'],
            'entity_id' => ['nullable', 'uuid'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
