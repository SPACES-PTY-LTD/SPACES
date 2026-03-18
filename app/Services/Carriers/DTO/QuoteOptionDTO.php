<?php

namespace App\Services\Carriers\DTO;

class QuoteOptionDTO
{
    public string $carrierCode;
    public string $serviceCode;
    public string $currency;
    public float $amount;
    public ?float $taxAmount;
    public float $totalAmount;
    public ?string $etaFrom;
    public ?string $etaTo;
    public ?array $rules;

    public function __construct(array $payload)
    {
        $this->carrierCode = $payload['carrier_code'];
        $this->serviceCode = $payload['service_code'];
        $this->currency = $payload['currency'] ?? 'ZAR';
        $this->amount = (float) $payload['amount'];
        $this->taxAmount = $payload['tax_amount'] ?? null;
        $this->totalAmount = (float) $payload['total_amount'];
        $this->etaFrom = $payload['eta_from'] ?? null;
        $this->etaTo = $payload['eta_to'] ?? null;
        $this->rules = $payload['rules'] ?? null;
    }
}
