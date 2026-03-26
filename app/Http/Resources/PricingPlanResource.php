<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PricingPlanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'plan_id' => $this->uuid,
            'title' => $this->title,
            'vehicle_limit' => (int) $this->vehicle_limit,
            'monthly_charge_zar' => (float) $this->monthly_charge_zar,
            'monthly_charge_usd' => (float) $this->monthly_charge_usd,
            'extra_vehicle_price_zar' => (float) $this->extra_vehicle_price_zar,
            'extra_vehicle_price_usd' => (float) $this->extra_vehicle_price_usd,
            'is_free' => (bool) $this->is_free,
            'trial_days' => $this->trial_days !== null ? (int) $this->trial_days : null,
            'is_active' => (bool) $this->is_active,
            'sort_order' => $this->sort_order,
        ];
    }
}
