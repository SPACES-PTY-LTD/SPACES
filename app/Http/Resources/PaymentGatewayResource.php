<?php

namespace App\Http\Resources;

use App\Services\Billing\BillingGatewayManager;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentGatewayResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var BillingGatewayManager $manager */
        $manager = app(BillingGatewayManager::class);
        $gateway = $manager->for($this->code);

        return [
            'payment_gateway_id' => $this->uuid,
            'code' => $this->code,
            'name' => $this->name,
            'type' => $this->type,
            'is_active' => (bool) $this->is_active,
            'sort_order' => $this->sort_order,
            'supports_card_retrieval' => $gateway->supportsCardRetrieval(),
            'supports_hosted_card_capture' => $gateway->supportsHostedCardCapture(),
        ];
    }
}
