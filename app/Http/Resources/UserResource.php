<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'user_id' => $this->uuid,
            'name' => $this->name,
            'email' => $this->email,
            'telephone' => $this->telephone,
            'role' => $this->role,
            'profile_photo_url' => $this->profile_photo_path ? Storage::disk('s3')->url($this->profile_photo_path) : null,
            'is_account_holder' => $this->whenLoaded(
                'account',
                fn () => $this->account && (int) $this->account->owner_user_id === (int) $this->id,
                false
            ),
            'account_country_code' => $this->whenLoaded(
                'account',
                fn () => $this->account?->country_code
            ),
            'last_login_at' => optional($this->last_login_at)?->toIso8601String(),
            'last_accessed_merchant_id' => $this->whenLoaded(
                'lastAccessedMerchant',
                fn () => $this->lastAccessedMerchant?->uuid
            ),
            'merchants' => MerchantMemberResource::collection($this->whenLoaded('merchants')),
        ];
    }
}
