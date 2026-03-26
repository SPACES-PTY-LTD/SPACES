<?php

namespace App\Services\Billing\Gateways;

use App\Models\Account;
use App\Models\AccountInvoice;
use App\Models\AccountPaymentMethod;
use App\Services\Billing\Data\ChargeResult;
use App\Services\Billing\Data\GatewayCustomerProfile;
use App\Services\Billing\Data\PaymentCard;
use App\Services\Billing\Data\PaymentCardCollection;
use App\Services\Billing\Data\PaymentMethodSetupIntent;

class PayfastBillingGateway implements BillingGatewayInterface
{
    public function code(): string
    {
        return 'payfast';
    }

    public function supportsCardRetrieval(): bool
    {
        return false;
    }

    public function supportsHostedCardCapture(): bool
    {
        return true;
    }

    public function ensureCustomerProfile(Account $account, array $payload = []): GatewayCustomerProfile
    {
        return new GatewayCustomerProfile(
            gatewayCode: $this->code(),
            gatewayCustomerId: $payload['gateway_customer_id'] ?? null,
            gatewayReference: $payload['gateway_reference'] ?? null,
            metadata: [
                'merchant_id_configured' => !empty(config('billing.payfast.merchant_id')),
                'mode' => 'token_reference',
            ],
        );
    }

    public function storePaymentMethodSetupIntent(Account $account, array $payload = []): PaymentMethodSetupIntent
    {
        return new PaymentMethodSetupIntent(
            gatewayCode: $this->code(),
            hostedCaptureSupported: true,
            mode: 'redirect',
            metadata: [
                'message' => 'Use PayFast tokenization or recurring billing setup and persist masked token/agreement metadata from the callback/webhook.',
            ],
        );
    }

    public function syncCustomerPaymentCards(Account $account): PaymentCardCollection
    {
        $cards = $account->paymentMethods()
            ->where('gateway_code', $this->code())
            ->get()
            ->map(fn (AccountPaymentMethod $method) => new PaymentCard(
                gatewayCode: $this->code(),
                gatewayCustomerId: $method->gateway_customer_id,
                gatewayPaymentMethodId: $method->gateway_payment_method_id,
                gatewayReference: $method->gateway_reference,
                brand: $method->brand,
                lastFour: $method->last_four,
                expiryMonth: $method->expiry_month,
                expiryYear: $method->expiry_year,
                fundingType: $method->funding_type,
                bank: $method->bank,
                signature: $method->signature,
                isReusable: (bool) $method->is_reusable,
                status: $method->status,
                retrievedFromGateway: false,
                metadata: $method->gateway_metadata ?? [],
            ))->all();

        return new PaymentCardCollection(
            gatewayCode: $this->code(),
            retrievedFromGateway: false,
            cards: $cards,
        );
    }

    public function chargeSavedPaymentMethod(AccountInvoice $invoice, AccountPaymentMethod $paymentMethod): ChargeResult
    {
        $success = !empty($paymentMethod->gateway_reference) && !empty(config('billing.payfast.merchant_id'));

        return new ChargeResult(
            success: $success,
            status: $success ? 'paid' : 'failed',
            providerReference: $paymentMethod->gateway_reference ?: $invoice->invoice_number,
            providerTransactionId: $paymentMethod->gateway_reference ?: null,
            failureReason: empty($paymentMethod->gateway_reference)
                ? 'Missing PayFast recurring token/agreement reference.'
                : (empty(config('billing.payfast.merchant_id')) ? 'PayFast credentials are not configured.' : null),
            responsePayload: [
                'gateway' => 'payfast',
                'sandbox' => (bool) config('billing.payfast.sandbox'),
            ],
        );
    }
}
