<?php

namespace App\Http\Resources;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TrackingProviderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'provider_id' => $this->uuid,
            'name' => $this->name,
            'status' => $this->status,
            'activated' => (bool) ($this->activated ?? false),
            'integration_data' => $this->whenLoaded('merchantIntegrations', function () {
                return $this->resolveIntegrationValue('integration_data');
            }),
            'integration_options_data' => $this->whenLoaded('merchantIntegrations', function () {
                return $this->resolveIntegrationValue('integration_options_data');
            }),
            'logo_file_name' => $this->logo_file_name,
            'website' => $this->website,
            'documentation' => $this->documentation,
            'supports_bulk_vehicle_requests' => (bool) $this->supports_bulk_vehicle_requests,
            'default_tracking' => (bool) $this->default_tracking,
            'has_location_services' => (bool) $this->has_location_services,
            'has_driver_importing' => (bool) $this->has_driver_importing,
            'has_locations_importing' => (bool) $this->has_locations_importing,
            'has_vehicle_importing' => (bool) $this->has_vehicle_importing,
            'form_fields' => TrackingProviderFormFieldResource::collection($this->whenLoaded('formFields')),
            'options' => TrackingProviderOptionResource::collection($this->whenLoaded('options')),
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }

    private function resolveIntegrationValue(string $attribute): mixed
    {
        $integration = $this->merchantIntegrations->first();
        if (!$integration) {
            return null;
        }

        try {
            return $integration->{$attribute};
        } catch (DecryptException) {
            return null;
        }
    }
}
