<?php

namespace App\Services\Billing\Data;

class PaymentMethodSetupIntent
{
    public function __construct(
        public readonly string $gatewayCode,
        public readonly bool $hostedCaptureSupported,
        public readonly string $mode,
        public readonly ?string $publishableKey = null,
        public readonly ?string $clientSecret = null,
        public readonly ?string $redirectUrl = null,
        public readonly array $metadata = [],
    ) {
    }

    public function toArray(): array
    {
        return [
            'gateway_code' => $this->gatewayCode,
            'hosted_capture_supported' => $this->hostedCaptureSupported,
            'mode' => $this->mode,
            'publishable_key' => $this->publishableKey,
            'client_secret' => $this->clientSecret,
            'redirect_url' => $this->redirectUrl,
            'metadata' => $this->metadata,
        ];
    }
}
