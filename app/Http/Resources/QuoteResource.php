<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsMerchantTimestamps;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuoteResource extends JsonResource
{
    use FormatsMerchantTimestamps;

    public function toArray(Request $request): array
    {
        return [
            'quote_id' => $this->uuid,
            'merchant_order_ref' => $this->merchant_order_ref,
            'merchant' => [
                'merchant_id' => optional($this->merchant)->uuid,
                'name' => optional($this->merchant)->name,
            ],
            'environment_id' => optional($this->environment)->uuid,
            'shipment_id' => optional($this->shipment)->uuid,
            'status' => $this->status,
            'requested_at' => $this->formatDateForMerchantTimezone($this->requested_at, $request),
            'collection_date' => $this->formatDateForMerchantTimezone($this->collection_date, $request),
            'expires_at' => $this->formatDateForMerchantTimezone($this->expires_at, $request),
            'options' => QuoteOptionResource::collection($this->whenLoaded('options')),
            'selected_option' => $this->when(
                $this->status === 'booked',
                fn () => $this->booking && $this->booking->relationLoaded('quoteOption')
                    ? new QuoteOptionResource($this->booking->quoteOption)
                    : null
            ),
        ];
    }
}
