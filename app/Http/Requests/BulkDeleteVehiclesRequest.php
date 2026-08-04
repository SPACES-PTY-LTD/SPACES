<?php

namespace App\Http\Requests;

class BulkDeleteVehiclesRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'merchant_id' => ['nullable', 'uuid'],
            'vehicle_ids' => ['required', 'array', 'min:1'],
            'vehicle_ids.*' => ['required', 'uuid', 'distinct'],
        ];
    }
}
