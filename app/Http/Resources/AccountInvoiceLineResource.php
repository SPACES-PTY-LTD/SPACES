<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountInvoiceLineResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'invoice_line_id' => $this->uuid,
            'type' => $this->type,
            'description' => $this->description,
            'quantity' => (int) $this->quantity,
            'unit_amount' => (float) $this->unit_amount,
            'subtotal' => (float) $this->subtotal,
            'included_vehicles' => (int) $this->included_vehicles,
            'billable_vehicles' => (int) $this->billable_vehicles,
            'merchant' => $this->merchant ? [
                'merchant_id' => $this->merchant->uuid,
                'name' => $this->merchant->name,
            ] : null,
            'plan' => $this->plan ? new PricingPlanResource($this->plan) : null,
            'snapshot' => $this->snapshot,
        ];
    }
}
