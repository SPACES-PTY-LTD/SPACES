<?php

namespace App\Http\Requests;

use App\Models\VehicleActivity;

class ListVehicleActivitiesRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['nullable', 'uuid', 'exists:merchants,uuid'],
            'vehicle_id' => ['nullable', 'uuid', 'exists:vehicles,uuid'],
            'plate_number' => ['nullable', 'string', 'max:255'],
            'location_id' => ['nullable', 'uuid', 'exists:locations,uuid'],
            'shipment_id' => ['nullable', 'uuid', 'exists:shipments,uuid'],
            'event_type' => ['nullable', 'string', 'in:' . implode(',', [
                VehicleActivity::EVENT_SPEEDING,
                VehicleActivity::EVENT_STOPPED,
                VehicleActivity::EVENT_MOVING,
                VehicleActivity::EVENT_ENTERED_LOCATION,
                VehicleActivity::EVENT_EXITED_LOCATION,
                VehicleActivity::EVENT_SHIPMENT_CREATED,
                VehicleActivity::EVENT_SHIPMENT_ENDED,
                VehicleActivity::EVENT_SHIPMENT_COLLECTION,
                VehicleActivity::EVENT_SHIPMENT_DELIVERY,
                VehicleActivity::EVENT_RUN_STARTED,
                VehicleActivity::EVENT_RUN_ENDED,
            ])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
