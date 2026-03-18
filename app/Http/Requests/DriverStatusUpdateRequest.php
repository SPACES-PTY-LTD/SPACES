<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class DriverStatusUpdateRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'in:booked,pickup_scheduled,picked_up,in_transit,out_for_delivery,delivered,failed'],
            'note' => ['nullable', 'string'],
        ];
    }
}
