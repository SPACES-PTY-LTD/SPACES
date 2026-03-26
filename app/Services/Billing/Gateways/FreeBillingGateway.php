<?php

namespace App\Services\Billing\Gateways;

use App\Models\Account;
use App\Models\AccountInvoice;
use App\Models\AccountPaymentMethod;
use App\Services\Billing\Data\ChargeResult;
use App\Services\Billing\Data\GatewayCustomerProfile;
use App\Services\Billing\Data\PaymentCardCollection;
use App\Services\Billing\Data\PaymentMethodSetupIntent;

class FreeBillingGateway implements BillingGatewayInterface
{
    public function code(): string
    {
        return 'free';
    }

    public function supportsCardRetrieval(): bool
    {
        return false;
    }

    public function supportsHostedCardCapture(): bool
    {
        return false;
    }

    public function ensureCustomerProfile(Account $account, array $payload = []): GatewayCustomerProfile
    {
        return new GatewayCustomerProfile(
            gatewayCode: $this->code(),
            gatewayCustomerId: 'free-' . $account->uuid,
            gatewayReference: 'free',
            metadata: ['synced' => true],
        );
    }

    public function storePaymentMethodSetupIntent(Account $account, array $payload = []): PaymentMethodSetupIntent
    {
        return new PaymentMethodSetupIntent(
            gatewayCode: $this->code(),
            hostedCaptureSupported: false,
            mode: 'none',
            metadata: ['message' => 'Free gateway does not use payment cards.'],
        );
    }

    public function syncCustomerPaymentCards(Account $account): PaymentCardCollection
    {
        return new PaymentCardCollection(
            gatewayCode: $this->code(),
            retrievedFromGateway: false,
            cards: [],
        );
    }

    public function chargeSavedPaymentMethod(AccountInvoice $invoice, AccountPaymentMethod $paymentMethod): ChargeResult
    {
        return new ChargeResult(
            success: true,
            status: 'paid',
            providerReference: 'free-' . $invoice->invoice_number,
            providerTransactionId: 'free-' . $invoice->uuid,
            responsePayload: ['gateway' => 'free'],
        );
    }
}
