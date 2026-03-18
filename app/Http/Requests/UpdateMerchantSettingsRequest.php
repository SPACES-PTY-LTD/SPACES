<?php

namespace App\Http\Requests;

class UpdateMerchantSettingsRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        parent::prepareForValidation();

        if ($this->has('operating_countries') && is_array($this->input('operating_countries'))) {
            $this->merge([
                'operating_countries' => array_map(
                    fn ($country) => is_string($country) ? strtoupper($country) : $country,
                    $this->input('operating_countries')
                ),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'timezone' => ['sometimes', 'required', 'timezone'],
            'operating_countries' => ['sometimes', 'required', 'array', 'min:1'],
            'operating_countries.*' => ['string', 'size:2', 'regex:/^[A-Z]{2}$/', 'distinct'],
            'allow_auto_shipment_creations_at_locations' => ['sometimes', 'boolean'],
            'support_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'max_driver_distance' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'delivery_offers_expiry_time' => ['sometimes', 'integer', 'min:1'],
            'driver_offline_timeout_minutes' => ['sometimes', 'integer', 'min:1'],
            'setup_completed_at' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
