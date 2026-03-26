<?php

namespace App\Services\Billing\Data;

class PaymentCard
{
    public function __construct(
        public readonly string $gatewayCode,
        public readonly ?string $gatewayCustomerId = null,
        public readonly ?string $gatewayPaymentMethodId = null,
        public readonly ?string $gatewayReference = null,
        public readonly ?string $brand = null,
        public readonly ?string $lastFour = null,
        public readonly ?int $expiryMonth = null,
        public readonly ?int $expiryYear = null,
        public readonly ?string $fundingType = null,
        public readonly ?string $bank = null,
        public readonly ?string $signature = null,
        public readonly bool $isReusable = true,
        public readonly string $status = 'active',
        public readonly bool $retrievedFromGateway = false,
        public readonly array $metadata = [],
    ) {
    }

    public function toArray(): array
    {
        return [
            'gateway_code' => $this->gatewayCode,
            'gateway_customer_id' => $this->gatewayCustomerId,
            'gateway_payment_method_id' => $this->gatewayPaymentMethodId,
            'gateway_reference' => $this->gatewayReference,
            'brand' => $this->brand,
            'last_four' => $this->lastFour,
            'expiry_month' => $this->expiryMonth,
            'expiry_year' => $this->expiryYear,
            'funding_type' => $this->fundingType,
            'bank' => $this->bank,
            'signature' => $this->signature,
            'is_reusable' => $this->isReusable,
            'status' => $this->status,
            'retrieved_from_gateway' => $this->retrievedFromGateway,
            'gateway_metadata' => $this->metadata,
        ];
    }
}
