<?php

namespace App\Http\Resources;

use App\Support\MerchantAccess;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MerchantMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'user_id' => $this->uuid,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->effective_role
                ?? MerchantAccess::normalizeRole($this->pivot->role ?? null),
            'status' => 'active',
        ];
    }
}
