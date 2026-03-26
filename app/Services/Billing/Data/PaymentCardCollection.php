<?php

namespace App\Services\Billing\Data;

class PaymentCardCollection
{
    /**
     * @param array<int, PaymentCard> $cards
     */
    public function __construct(
        public readonly string $gatewayCode,
        public readonly bool $retrievedFromGateway,
        public readonly array $cards,
    ) {
    }
}
