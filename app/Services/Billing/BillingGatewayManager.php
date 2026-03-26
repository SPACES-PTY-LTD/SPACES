<?php

namespace App\Services\Billing;

use App\Services\Billing\Gateways\BillingGatewayInterface;
use App\Services\Billing\Gateways\FreeBillingGateway;
use App\Services\Billing\Gateways\PayfastBillingGateway;
use App\Services\Billing\Gateways\PaystackBillingGateway;
use App\Services\Billing\Gateways\StripeBillingGateway;
use InvalidArgumentException;

class BillingGatewayManager
{
    /** @var array<string, BillingGatewayInterface> */
    private array $gateways;

    public function __construct(
        FreeBillingGateway $free,
        StripeBillingGateway $stripe,
        PayfastBillingGateway $payfast,
        PaystackBillingGateway $paystack,
    ) {
        $this->gateways = [
            $free->code() => $free,
            $stripe->code() => $stripe,
            $payfast->code() => $payfast,
            $paystack->code() => $paystack,
        ];
    }

    public function for(string $code): BillingGatewayInterface
    {
        $gateway = $this->gateways[$code] ?? null;
        if (!$gateway) {
            throw new InvalidArgumentException('Unsupported billing gateway: ' . $code);
        }

        return $gateway;
    }
}
