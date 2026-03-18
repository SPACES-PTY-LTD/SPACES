<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsMerchantTimestamps;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuoteOptionResource extends JsonResource
{
    use FormatsMerchantTimestamps;

    public function toArray(Request $request): array
    {
        return [
            'quote_option_id' => $this->uuid,
            'carrier_code' => $this->carrier_code,
            'service_code' => $this->service_code,
            'currency' => $this->currency,
            'amount' => $this->amount,
            'tax_amount' => $this->tax_amount,
            'total_amount' => $this->total_amount,
            'eta_from' => $this->formatDateForMerchantTimezone($this->eta_from, $request),
            'eta_to' => $this->formatDateForMerchantTimezone($this->eta_to, $request),
            'rules' => $this->rules,
        ];
    }
}
