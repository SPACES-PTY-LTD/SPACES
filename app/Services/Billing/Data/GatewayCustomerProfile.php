<?php

namespace App\Services\Billing\Data;

class GatewayCustomerProfile
{
    public function __construct(
        public readonly string $gatewayCode,
        public readonly ?string $gatewayCustomerId = null,
        public readonly ?string $gatewayReference = null,
        public readonly array $metadata = [],
    ) {
    }

    public function toArray(): array
    {
        return [
            'gateway_code' => $this->gatewayCode,
            'gateway_customer_id' => $this->gatewayCustomerId,
            'gateway_reference' => $this->gatewayReference,
            'gateway_metadata' => $this->metadata,
        ];
    }
}
