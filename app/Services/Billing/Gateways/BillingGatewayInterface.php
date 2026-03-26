<?php

namespace App\Services\Billing\Gateways;

use App\Models\Account;
use App\Models\AccountInvoice;
use App\Models\AccountPaymentMethod;
use App\Services\Billing\Data\ChargeResult;
use App\Services\Billing\Data\GatewayCustomerProfile;
use App\Services\Billing\Data\PaymentCardCollection;
use App\Services\Billing\Data\PaymentMethodSetupIntent;

interface BillingGatewayInterface
{
    public function code(): string;

    public function supportsCardRetrieval(): bool;

    public function supportsHostedCardCapture(): bool;

    public function ensureCustomerProfile(Account $account, array $payload = []): GatewayCustomerProfile;

    public function storePaymentMethodSetupIntent(Account $account, array $payload = []): PaymentMethodSetupIntent;

    public function syncCustomerPaymentCards(Account $account): PaymentCardCollection;

    public function chargeSavedPaymentMethod(AccountInvoice $invoice, AccountPaymentMethod $paymentMethod): ChargeResult;
}
