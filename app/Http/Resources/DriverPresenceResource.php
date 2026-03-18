<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DriverPresenceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $merchant = $this->driver?->merchant;
        $timeoutMinutes = (int) ($merchant?->driver_offline_timeout_minutes ?? 120);
        $lastSeenAt = optional($this->last_seen_at);

        return [
            'presence_id' => $this->uuid,
            'driver_id' => optional($this->driver)->uuid,
            'user_device_id' => optional($this->userDevice)->uuid,
            'is_online' => (bool) $this->is_online,
            'is_available' => (bool) $this->is_available,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'last_seen_at' => $lastSeenAt?->toIso8601String(),
            'last_offered_at' => optional($this->last_offered_at)?->toIso8601String(),
            'stale_after_at' => $lastSeenAt?->copy()->addMinutes($timeoutMinutes)?->toIso8601String(),
            'active_offers' => DeliveryOfferResource::collection(
                $this->driver?->deliveryOffers
                    ? $this->driver->deliveryOffers
                        ->where('status', 'pending')
                        ->filter(fn ($offer) => optional($offer->expires_at)?->isFuture())
                        ->values()
                    : collect()
            ),
        ];
    }
}
