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
use Illuminate\Support\Facades\Http;

class StripeBillingGateway implements BillingGatewayInterface
{
    public function code(): string
    {
        return 'stripe';
    }

    public function supportsCardRetrieval(): bool
    {
        return true;
    }

    public function supportsHostedCardCapture(): bool
    {
        return true;
    }

    public function ensureCustomerProfile(Account $account, array $payload = []): GatewayCustomerProfile
    {
        if (!empty($payload['gateway_customer_id'])) {
            return new GatewayCustomerProfile(
                gatewayCode: $this->code(),
                gatewayCustomerId: $payload['gateway_customer_id'],
                gatewayReference: $payload['gateway_reference'] ?? $payload['gateway_customer_id'],
                metadata: $payload['gateway_metadata'] ?? [],
            );
        }

        $secretKey = (string) config('billing.stripe.secret_key');

        if ($secretKey === '') {
            return new GatewayCustomerProfile(
                gatewayCode: $this->code(),
                gatewayCustomerId: $payload['gateway_customer_id'] ?? null,
                gatewayReference: $payload['gateway_reference'] ?? null,
                metadata: ['mode' => 'manual'],
            );
        }

        $response = Http::asForm()
            ->withBasicAuth($secretKey, '')
            ->post('https://api.stripe.com/v1/customers', [
                'email' => $account->owner?->email,
                'name' => $account->owner?->name,
                'metadata[account_uuid]' => $account->uuid,
            ])->throw()->json();

        return new GatewayCustomerProfile(
            gatewayCode: $this->code(),
            gatewayCustomerId: $response['id'] ?? null,
            gatewayReference: $response['id'] ?? null,
            metadata: $response,
        );
    }

    public function storePaymentMethodSetupIntent(Account $account, array $payload = []): PaymentMethodSetupIntent
    {
        $profile = $this->ensureCustomerProfile($account, $payload);
        $secretKey = (string) config('billing.stripe.secret_key');
        $publishableKey = (string) config('billing.stripe.publishable_key');

        if ($secretKey === '') {
            return new PaymentMethodSetupIntent(
                gatewayCode: $this->code(),
                hostedCaptureSupported: true,
                mode: 'client_secret',
                publishableKey: $publishableKey !== '' ? $publishableKey : null,
                metadata: ['message' => 'Stripe credentials are not configured.'],
            );
        }

        $response = Http::asForm()
            ->withBasicAuth($secretKey, '')
            ->post('https://api.stripe.com/v1/setup_intents', [
                'customer' => $profile->gatewayCustomerId,
                'usage' => 'off_session',
                'automatic_payment_methods[enabled]' => 'true',
                'metadata[account_uuid]' => $account->uuid,
            ])->throw()->json();

        return new PaymentMethodSetupIntent(
            gatewayCode: $this->code(),
            hostedCaptureSupported: true,
            mode: 'client_secret',
            publishableKey: $publishableKey !== '' ? $publishableKey : null,
            clientSecret: $response['client_secret'] ?? null,
            metadata: ['customer_id' => $profile->gatewayCustomerId],
        );
    }

    public function syncCustomerPaymentCards(Account $account): PaymentCardCollection
    {
        $profile = $account->billingProfile;
        $secretKey = (string) config('billing.stripe.secret_key');

        if (!$profile?->gateway_customer_id || $secretKey === '') {
            return new PaymentCardCollection(
                gatewayCode: $this->code(),
                retrievedFromGateway: true,
                cards: [],
            );
        }

        $response = Http::withBasicAuth($secretKey, '')
            ->get('https://api.stripe.com/v1/payment_methods', [
                'customer' => $profile->gateway_customer_id,
                'type' => 'card',
            ])->throw()->json();

        $cards = collect($response['data'] ?? [])->map(function (array $method) use ($profile) {
            $card = $method['card'] ?? [];

            return new PaymentCard(
                gatewayCode: $this->code(),
                gatewayCustomerId: $profile->gateway_customer_id,
                gatewayPaymentMethodId: $method['id'] ?? null,
                gatewayReference: $method['id'] ?? null,
                brand: $card['brand'] ?? null,
                lastFour: $card['last4'] ?? null,
                expiryMonth: $card['exp_month'] ?? null,
                expiryYear: $card['exp_year'] ?? null,
                fundingType: $card['funding'] ?? null,
                isReusable: true,
                status: 'active',
                retrievedFromGateway: true,
                metadata: $method,
            );
        })->all();

        return new PaymentCardCollection(
            gatewayCode: $this->code(),
            retrievedFromGateway: true,
            cards: $cards,
        );
    }

    public function chargeSavedPaymentMethod(AccountInvoice $invoice, AccountPaymentMethod $paymentMethod): ChargeResult
    {
        $secretKey = (string) config('billing.stripe.secret_key');
        if ($secretKey === '') {
            return new ChargeResult(
                success: false,
                status: 'failed',
                failureReason: 'Stripe credentials are not configured.',
                responsePayload: ['gateway' => 'stripe'],
            );
        }

        $response = Http::asForm()
            ->withBasicAuth($secretKey, '')
            ->post('https://api.stripe.com/v1/payment_intents', [
                'amount' => (int) round((float) $invoice->total * 100),
                'currency' => strtolower($invoice->currency),
                'customer' => $paymentMethod->gateway_customer_id,
                'payment_method' => $paymentMethod->gateway_payment_method_id,
                'confirm' => 'true',
                'off_session' => 'true',
                'description' => 'Invoice ' . $invoice->invoice_number,
                'metadata[invoice_uuid]' => $invoice->uuid,
            ])->json();

        $status = $response['status'] ?? 'failed';

        return new ChargeResult(
            success: in_array($status, ['succeeded', 'processing'], true),
            status: in_array($status, ['succeeded', 'processing'], true) ? 'paid' : 'failed',
            providerReference: $response['id'] ?? null,
            providerTransactionId: $response['latest_charge'] ?? ($response['id'] ?? null),
            failureReason: $response['last_payment_error']['message'] ?? null,
            responsePayload: $response,
        );
    }
}
