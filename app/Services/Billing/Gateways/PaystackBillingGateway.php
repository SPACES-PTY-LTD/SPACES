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

class PaystackBillingGateway implements BillingGatewayInterface
{
    public function code(): string
    {
        return 'paystack';
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
        if (!empty($payload['gateway_customer_id'])) {
            return new GatewayCustomerProfile(
                gatewayCode: $this->code(),
                gatewayCustomerId: $payload['gateway_customer_id'],
                gatewayReference: $payload['gateway_reference'] ?? $payload['gateway_customer_id'],
                metadata: $payload['gateway_metadata'] ?? [],
            );
        }

        $secretKey = (string) config('billing.paystack.secret_key');

        if ($secretKey === '') {
            return new GatewayCustomerProfile(
                gatewayCode: $this->code(),
                gatewayCustomerId: $payload['gateway_customer_id'] ?? null,
                gatewayReference: $payload['gateway_reference'] ?? null,
                metadata: ['mode' => 'manual'],
            );
        }

        $response = Http::withToken($secretKey)
            ->post('https://api.paystack.co/customer', [
                'email' => $account->owner?->email,
                'first_name' => $account->owner?->name,
                'metadata' => ['account_uuid' => $account->uuid],
            ])->throw()->json();

        $customer = $response['data'] ?? [];

        return new GatewayCustomerProfile(
            gatewayCode: $this->code(),
            gatewayCustomerId: $customer['customer_code'] ?? null,
            gatewayReference: $customer['customer_code'] ?? null,
            metadata: $customer,
        );
    }

    public function storePaymentMethodSetupIntent(Account $account, array $payload = []): PaymentMethodSetupIntent
    {
        $profile = $this->ensureCustomerProfile($account, $payload);
        $publicKey = (string) config('billing.paystack.public_key');

        return new PaymentMethodSetupIntent(
            gatewayCode: $this->code(),
            hostedCaptureSupported: true,
            mode: 'redirect',
            publishableKey: $publicKey !== '' ? $publicKey : null,
            metadata: [
                'customer_id' => $profile->gatewayCustomerId,
                'message' => 'Use Paystack hosted or inline payment collection and persist masked authorization metadata from the callback/webhook.',
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
        $secretKey = (string) config('billing.paystack.secret_key');
        if ($secretKey === '') {
            return new ChargeResult(
                success: false,
                status: 'failed',
                failureReason: 'Paystack credentials are not configured.',
                responsePayload: ['gateway' => 'paystack'],
            );
        }

        $response = Http::withToken($secretKey)
            ->post('https://api.paystack.co/transaction/charge_authorization', [
                'email' => $invoice->account?->owner?->email,
                'amount' => (int) round((float) $invoice->total * 100),
                'authorization_code' => $paymentMethod->gateway_payment_method_id,
                'reference' => $invoice->invoice_number,
                'metadata' => ['invoice_uuid' => $invoice->uuid],
            ])->json();

        $data = $response['data'] ?? [];
        $success = (bool) ($response['status'] ?? false);

        return new ChargeResult(
            success: $success,
            status: $success ? 'paid' : 'failed',
            providerReference: $data['reference'] ?? $invoice->invoice_number,
            providerTransactionId: $data['reference'] ?? null,
            failureReason: $response['message'] ?? null,
            responsePayload: $response,
        );
    }
}
