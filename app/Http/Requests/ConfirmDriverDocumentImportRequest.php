<?php

namespace App\Http\Requests;

class ConfirmDriverDocumentImportRequest extends ConfirmDeliveryNoteImportRequest
{
    public function rules(): array
    {
        $rules = array_replace(parent::rules(), [
            'run_id' => ['sometimes', 'nullable', 'uuid'],
            'create_new_run' => ['sometimes', 'boolean'],
            'vehicle_id' => ['nullable', 'uuid'],
            'origin_location_id' => ['required_with:create_new_run', 'nullable', 'uuid'],
            'destination_location_id' => ['required_with:create_new_run', 'nullable', 'uuid'],
            'review_token' => ['required_with:create_new_run', 'nullable', 'string'],
            'line_items.*.status' => ['nullable', 'in:delivered,in_transit,failed'],
            'line_items.*.failure_reason' => ['required_if:line_items.*.status,failed', 'nullable', 'string', 'max:2000'],
            'line_items.*.odometer_at_collection' => ['nullable', 'integer', 'min:0'],
            'line_items.*.odometer_at_delivery' => ['nullable', 'integer', 'min:0'],
            'line_items.*.excluded' => ['sometimes', 'boolean'],
            'collection_date' => ['required', 'date_format:Y-m-d'],
            'line_items' => ['required', 'array', 'min:1', 'max:100'],
            'line_items.*.collection_date' => ['nullable', 'date_format:Y-m-d'],
            'line_items.*.quantity' => ['nullable', 'integer', 'min:1', 'max:100'],
            // Driver imports use reviewed address fields, never unrestricted location IDs.
            'pickup_location_id' => ['prohibited'],
            'dropoff_location_id' => ['prohibited'],
        ]);
        foreach (['pickup_address', 'dropoff_address'] as $kind) {
            $rules["line_items.*.$kind"] = ['nullable', 'array'];
            foreach (['name', 'address_line_1', 'address_line_2', 'town', 'city', 'province', 'post_code', 'country', 'company', 'first_name', 'last_name', 'phone'] as $field) {
                $rules["$kind.$field"] = ['nullable', 'string', 'max:255'];
                $rules["line_items.*.$kind.$field"] = ['nullable', 'string', 'max:255'];
            }
        }
        // Invalid extracted rows may be explicitly excluded without blocking valid rows.
        foreach ($this->input('line_items', []) as $index => $item) {
            if (!empty($item['excluded'])) {
                foreach (array_keys($rules) as $key) {
                    if (str_starts_with($key, 'line_items.*.') && !in_array($key, ['line_items.*.excluded', 'line_items.*.merchant_order_ref'])) {
                        $rules[str_replace('*', (string) $index, $key)] = ['exclude'];
                    }
                }
                $rules["line_items.$index.merchant_order_ref"] = ['nullable', 'string', 'max:255'];
            }
        }
        return $rules;
    }
}
