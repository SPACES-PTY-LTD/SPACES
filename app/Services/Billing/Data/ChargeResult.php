<?php

namespace App\Services\Billing\Data;

class ChargeResult
{
    public function __construct(
        public readonly bool $success,
        public readonly string $status,
        public readonly ?string $providerReference = null,
        public readonly ?string $providerTransactionId = null,
        public readonly ?string $failureReason = null,
        public readonly array $responsePayload = [],
    ) {
    }

    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'status' => $this->status,
            'provider_reference' => $this->providerReference,
            'provider_transaction_id' => $this->providerTransactionId,
            'failure_reason' => $this->failureReason,
            'response_payload' => $this->responsePayload,
        ];
    }
}
