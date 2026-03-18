<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MerchantInviteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'invite_id' => $this->uuid,
            'merchant_id' => optional($this->merchant)->uuid,
            'email' => $this->email,
            'role' => $this->role,
            'expires_at' => optional($this->expires_at)?->toIso8601String(),
            'accepted_at' => optional($this->accepted_at)?->toIso8601String(),
            'revoked_at' => optional($this->revoked_at)?->toIso8601String(),
            'created_at' => optional($this->created_at)?->toIso8601String(),
        ];
    }
}
