<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsMerchantTimestamps;
use App\Support\MerchantAccess;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MerchantResource extends JsonResource
{
    use FormatsMerchantTimestamps;

    public function toArray(Request $request): array
    {
        return [
            'merchant_id' => $this->uuid,
            'name' => $this->name,
            'legal_name' => $this->legal_name,
            'status' => $this->status,
            'billing_email' => $this->billing_email,
            'support_email' => $this->support_email,
            'max_driver_distance' => $this->max_driver_distance,
            'delivery_offers_expiry_time' => $this->delivery_offers_expiry_time,
            'driver_offline_timeout_minutes' => $this->driver_offline_timeout_minutes,
            'default_webhook_url' => $this->default_webhook_url,
            'timezone' => $this->timezone ?? 'UTC',
            'operating_countries' => $this->operating_countries ?? [],
            'allow_auto_shipment_creations_at_locations' => (bool) $this->allow_auto_shipment_creations_at_locations,
            'setup_completed_at' => $this->setup_completed_at ? $this->formatDateForMerchantTimezone($this->setup_completed_at, $request) : null,
            'metadata' => $this->metadata,
            'owner' => new UserResource($this->whenLoaded('owner')),
            'members' => MerchantMemberResource::collection($this->whenLoaded('users')),
            'access' => $this->when(
                $request->user() !== null,
                fn () => [
                    'role' => MerchantAccess::roleFor($request->user(), $this->resource),
                    'permissions' => MerchantAccess::permissionsFor($request->user(), $this->resource),
                ]
            ),
            'created_at' => $this->formatDateForMerchantTimezone($this->created_at, $request),
        ];
    }
}
