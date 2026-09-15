<?php

namespace App\Http\Resources;

use App\Models\RunCost;
use App\Support\CostMoney;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdditionalCostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'cost_id' => $this->uuid,
            'title' => $this->title,
            'amount' => CostMoney::format(CostMoney::units($this->amount), $this->currency),
            'currency' => $this->currency,
            'source' => $this->resource instanceof RunCost ? $this->source : 'geofence',
            'location_name' => $this->location_name,
            'visited_at' => $this->visited_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
