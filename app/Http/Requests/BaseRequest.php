<?php

namespace App\Http\Requests;

use App\Support\ApiResponse;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class BaseRequest extends FormRequest
{
    protected function prepareForValidation()
    {
        $aliases = [
            'merchant_id' => 'merchant_uuid',
            'environment_id' => 'environment_uuid',
            'shipment_id' => 'shipment_uuid',
            'quote_id' => 'quote_uuid',
            'quote_option_id' => 'quote_option_uuid',
            'option_id' => 'quote_option_uuid',
            'booking_id' => 'booking_uuid',
            'run_id' => 'run_uuid',
            'route_id' => 'route_uuid',
            'driver_id' => 'driver_uuid',
            'vehicle_id' => 'vehicle_uuid',
            'vehicle_type_id' => 'vehicle_type_uuid',
            'location_type_id' => 'location_type_uuid',
            'carrier_id' => 'carrier_uuid',
            'user_id' => 'user_uuid',
            'invite_id' => 'invite_uuid',
            'subscription_id' => 'subscription_uuid',
            'cancel_reason_id' => 'cancel_reason_uuid',
        ];

        $input = $this->all();
        $merge = [];
        foreach ($aliases as $idKey => $uuidKey) {
            if (array_key_exists($idKey, $input) && !array_key_exists($uuidKey, $input)) {
                $merge[$uuidKey] = $input[$idKey];
            }
            if (array_key_exists($uuidKey, $input) && !array_key_exists($idKey, $input)) {
                $merge[$idKey] = $input[$uuidKey];
            }
        }

        if ($merge) {
            $this->merge($merge);
        }
    }

    protected function failedValidation(Validator $validator)
    {
        $first = $validator->errors()->first();

        throw new HttpResponseException(response()->json([
            'success' => false,
            'error' => [
                'code' => 'VALIDATION',
                'message' => $first,
                'details' => null,
                'request_id' => ApiResponse::requestId(),
            ],
        ], 422));
    }
}
