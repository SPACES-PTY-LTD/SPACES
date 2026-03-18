<?php

namespace App\Http\Requests;

class ImportTrackingProviderDriversRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['required', 'uuid', 'exists:merchants,uuid'],
        ];
    }
}
