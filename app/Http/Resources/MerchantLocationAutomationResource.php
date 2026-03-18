<?php

namespace App\Http\Resources;

use App\Models\LocationType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MerchantLocationAutomationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $settings = $this->location_automation_settings ?? [];
        $storedRules = collect($settings['location_types'] ?? []);
        $locationTypeUuids = $storedRules
            ->pluck('location_type_id')
            ->filter()
            ->unique()
            ->values();

        $locationTypes = LocationType::query()
            ->where('merchant_id', $this->id)
            ->whereIn('uuid', $locationTypeUuids)
            ->get()
            ->keyBy('uuid');

        return [
            'merchant_id' => $this->uuid,
            'enabled' => (bool) $this->allow_auto_shipment_creations_at_locations,
            'location_types' => $storedRules->map(function (array $rule) use ($locationTypes) {
                $locationType = $locationTypes->get($rule['location_type_id'] ?? null);

                return [
                    'location_type_id' => $rule['location_type_id'] ?? null,
                    'location_type_name' => $locationType?->title ?? ($rule['location_type_name'] ?? null),
                    'location_type_slug' => $locationType?->slug ?? ($rule['location_type_slug'] ?? null),
                    'location_type_icon' => $locationType?->icon ?? ($rule['location_type_icon'] ?? null),
                    'location_type_color' => $locationType?->color ?? ($rule['location_type_color'] ?? null),
                    'entry' => $rule['entry'] ?? [],
                    'exit' => $rule['exit'] ?? [],
                ];
            })->values()->all(),
        ];
    }
}
