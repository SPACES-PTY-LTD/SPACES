<?php

namespace App\Http\Requests;

use App\Models\CancelReason;
use App\Http\Requests\BaseRequest;

class UpdateCancelReasonRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $reasonId = CancelReason::where('uuid', $this->route('cancel_reason_uuid'))->value('id');

        return [
            'code' => ['sometimes', 'string', 'max:50', 'unique:cancel_reasons,code,'.$reasonId],
            'title' => ['sometimes', 'string', 'max:255'],
            'enabled' => ['sometimes', 'boolean'],
        ];
    }
}
