<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MerchantEnvironmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'environment_id' => $this->uuid,
            'merchant_id' => optional($this->merchant)->uuid,
            'name' => $this->name,
            'color' => $this->color,
            'url' => $this->url,
            'token' => $this->token,
            'last_used_at' => optional($this->last_used_at)?->toIso8601String(),
            'created_at' => optional($this->created_at)?->toIso8601String(),
        ];
    }
}
