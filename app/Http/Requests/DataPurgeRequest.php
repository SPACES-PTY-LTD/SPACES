<?php

namespace App\Http\Requests;

use App\Services\DataPurgeService;
use Illuminate\Validation\Rule;

class DataPurgeRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['required', 'uuid', 'exists:merchants,uuid'],
            'password' => ['required', 'string'],
            'types' => ['required', 'array', 'min:1'],
            'types.*' => ['required', 'string', 'distinct', Rule::in(DataPurgeService::allowedTypes())],
        ];
    }
}
