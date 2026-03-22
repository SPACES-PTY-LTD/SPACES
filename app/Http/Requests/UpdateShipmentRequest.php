<?php

namespace App\Http\Requests;

use App\Http\Requests\BaseRequest;

class UpdateShipmentRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'pickup_address' => ['sometimes', 'array'],
            'pickup_address.name' => ['nullable', 'string', 'max:255'],
            'pickup_address.code' => ['nullable', 'string', 'max:100'],
            'pickup_address.company' => ['nullable', 'string', 'max:255'],
            'pickup_address.address_line_1' => ['required_with:pickup_address', 'string', 'max:255'],
            'pickup_address.address_line_2' => ['nullable', 'string', 'max:255'],
            'pickup_address.town' => ['nullable', 'string', 'max:255'],
            'pickup_address.city' => ['required_with:pickup_address', 'string', 'max:255'],
            'pickup_address.country' => ['nullable', 'string', 'max:100'],
            'pickup_address.first_name' => ['nullable', 'string', 'max:255'],
            'pickup_address.last_name' => ['nullable', 'string', 'max:255'],
            'pickup_address.phone' => ['nullable', 'string', 'max:50'],
            'pickup_address.province' => ['required_with:pickup_address', 'string', 'max:255'],
            'pickup_address.post_code' => ['required_with:pickup_address', 'string', 'max:20'],
            'pickup_address.latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'pickup_address.longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'pickup_address.google_place_id' => ['nullable', 'string', 'max:255'],
            'pickup_address.location_type_id' => ['nullable', 'uuid', 'exists:location_types,uuid'],
            'pickup_address.location_type' => ['nullable', 'string', 'max:100'],
            'pickup_address.location_type_slug' => ['nullable', 'string', 'max:100'],
            'dropoff_address' => ['sometimes', 'array'],
            'dropoff_address.name' => ['nullable', 'string', 'max:255'],
            'dropoff_address.code' => ['nullable', 'string', 'max:100'],
            'dropoff_address.company' => ['nullable', 'string', 'max:255'],
            'dropoff_address.address_line_1' => ['required_with:dropoff_address', 'string', 'max:255'],
            'dropoff_address.address_line_2' => ['nullable', 'string', 'max:255'],
            'dropoff_address.town' => ['nullable', 'string', 'max:255'],
            'dropoff_address.city' => ['required_with:dropoff_address', 'string', 'max:255'],
            'dropoff_address.country' => ['nullable', 'string', 'max:100'],
            'dropoff_address.first_name' => ['nullable', 'string', 'max:255'],
            'dropoff_address.last_name' => ['nullable', 'string', 'max:255'],
            'dropoff_address.phone' => ['nullable', 'string', 'max:50'],
            'dropoff_address.province' => ['required_with:dropoff_address', 'string', 'max:255'],
            'dropoff_address.post_code' => ['required_with:dropoff_address', 'string', 'max:20'],
            'dropoff_address.latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'dropoff_address.longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'dropoff_address.google_place_id' => ['nullable', 'string', 'max:255'],
            'dropoff_address.location_type_id' => ['nullable', 'uuid', 'exists:location_types,uuid'],
            'dropoff_address.location_type' => ['nullable', 'string', 'max:100'],
            'dropoff_address.location_type_slug' => ['nullable', 'string', 'max:100'],
            'pickup_instructions' => ['nullable', 'string'],
            'dropoff_instructions' => ['nullable', 'string'],
            'delivery_note_number' => ['nullable', 'string', 'max:120'],
            'invoice_number' => ['nullable', 'string', 'max:120'],
            'invoiced_at' => ['nullable', 'date'],
            'requested_vehicle_type_id' => ['nullable', 'uuid', 'exists:vehicle_types,uuid'],
            'requested_vehicle_type' => ['nullable', 'string', 'max:100', 'exists:vehicle_types,code'],
            'ready_at' => ['nullable', 'date'],
            'collection_date' => ['nullable', 'date'],
            'service_type' => ['nullable', 'in:on_demand,same_day,scheduled'],
            'priority' => ['nullable', 'in:low,normal,high,urgent'],
            'auto_assign' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
            'metadata' => ['nullable', 'array'],
            'parcels' => ['sometimes', 'array', 'min:1'],
            'parcels.*.weight' => ['nullable', 'numeric', 'min:0.01'],
            'parcels.*.weight_measurement' => ['nullable', 'string', 'max:20'],
            'parcels.*.type' => ['nullable', 'string', 'max:50'],
            'parcels.*.length_cm' => ['nullable', 'numeric', 'min:0.01'],
            'parcels.*.width_cm' => ['nullable', 'numeric', 'min:0.01'],
            'parcels.*.height_cm' => ['nullable', 'numeric', 'min:0.01'],
            'parcels.*.declared_value' => ['nullable', 'numeric', 'min:0'],
            'parcels.*.contents_description' => ['required_with:parcels', 'string', 'max:255'],
        ];
    }
}
