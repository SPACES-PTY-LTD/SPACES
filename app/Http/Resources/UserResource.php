<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

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
            'last_login_at' => optional($this->last_login_at)?->toIso8601String(),
            'merchants' => MerchantMemberResource::collection($this->whenLoaded('merchants')),
        ];
    }
}
