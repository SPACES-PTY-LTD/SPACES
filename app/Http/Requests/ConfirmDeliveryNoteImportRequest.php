<?php

namespace App\Http\Requests;

class ConfirmDeliveryNoteImportRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $address = [
            'name' => ['nullable', 'string', 'max:255'],
            'company' => ['nullable', 'string', 'max:255'],
            'address_line_1' => ['required', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'town' => ['nullable', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'province' => ['required', 'string', 'max:255'],
            'post_code' => ['required', 'string', 'max:20'],
            'country' => ['nullable', 'string', 'max:100'],
            'first_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
        ];

        $rules = [
            'grouping_mode' => ['required', 'in:separate_shipments,single_shipment'],
            'delivery_note_number' => ['nullable', 'string', 'max:120'],
            'merchant_order_ref' => ['required_if:grouping_mode,single_shipment', 'nullable', 'string', 'max:255'],
            'collection_date' => ['required', 'date'],
            'pickup_address' => ['required', 'array'],
            'dropoff_address' => ['required', 'array'],
            'pickup_instructions' => ['nullable', 'string'],
            'dropoff_instructions' => ['nullable', 'string'],
            'line_items' => ['required', 'array', 'min:1'],
            'line_items.*.merchant_order_ref' => ['required_if:grouping_mode,separate_shipments', 'nullable', 'string', 'max:255'],
            'line_items.*.description' => ['required', 'string', 'max:255'],
            'line_items.*.quantity' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'line_items.*.type' => ['nullable', 'string', 'max:50'],
            'line_items.*.weight' => ['nullable', 'numeric', 'min:0.01'],
            'line_items.*.length_cm' => ['nullable', 'numeric', 'min:0.01'],
            'line_items.*.width_cm' => ['nullable', 'numeric', 'min:0.01'],
            'line_items.*.height_cm' => ['nullable', 'numeric', 'min:0.01'],
        ];

        foreach ($address as $key => $rule) {
            $rules["pickup_address.{$key}"] = $rule;
            $rules["dropoff_address.{$key}"] = $rule;
        }

        return $rules;
    }
}
