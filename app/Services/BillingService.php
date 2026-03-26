<?php

namespace App\Services;

use App\Models\Account;
use App\Models\AccountBillingProfile;
use App\Models\AccountInvoice;
use App\Models\AccountInvoiceLine;
use App\Models\AccountInvoicePaymentAttempt;
use App\Models\AccountPaymentMethod;
use App\Models\CountryPricing;
use App\Models\Merchant;
use App\Models\PaymentGateway;
use App\Models\PricingPlan;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\Billing\BillingGatewayManager;
use App\Services\Billing\Data\PaymentCard;
use App\Support\BillingAccess;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BillingService
{
    public function __construct(
        private BillingGatewayManager $gatewayManager
    ) {
    }

    public function resolveCountryPricing(Account $account): CountryPricing
    {
        $countryCode = strtoupper((string) $account->country_code);

        return CountryPricing::query()
            ->with('paymentGateway')
            ->where('country_code', $countryCode)
            ->first()
            ?? CountryPricing::query()->with('paymentGateway')->where('is_default', true)->firstOrFail();
    }

    public function listPaymentGateways(): \Illuminate\Support\Collection
    {
        return PaymentGateway::query()->orderBy('sort_order')->orderBy('name')->get();
    }

    public function listCountryPricing(): \Illuminate\Support\Collection
    {
        return CountryPricing::query()->with('paymentGateway')->orderByDesc('is_default')->orderBy('country_name')->get();
    }

    public function listPricingPlans(): \Illuminate\Support\Collection
    {
        return PricingPlan::query()->orderBy('sort_order')->orderBy('vehicle_limit')->get();
    }

    public function listPricingPlansForAccount(Account $account): \Illuminate\Support\Collection
    {
        $allowFreePlan = $this->canAccountSelectFreePlan($account)
            || $account->merchants()->whereHas('plan', fn (Builder $query) => $query->where('is_free', true))->exists();

        return PricingPlan::query()
            ->where('is_active', true)
            ->when(!$allowFreePlan, fn (Builder $query) => $query->where('is_free', false))
            ->orderBy('sort_order')
            ->orderBy('vehicle_limit')
            ->get();
    }

    public function listAccountInvoices(Account $account, int $perPage = 15): LengthAwarePaginator
    {
        return AccountInvoice::query()
            ->where('account_id', $account->id)
            ->latest('billing_period_start')
            ->paginate($perPage);
    }

    public function getBillingAccountForUser(User $user, ?string $accountUuid = null): Account
    {
        $query = Account::query()->with([
            'owner',
            'merchants.plan',
            'billingProfile.paymentGateway',
            'paymentMethods.paymentGateway',
        ]);

        if ($accountUuid) {
            $query->where('uuid', $accountUuid);
        } elseif (!empty($user->account_id)) {
            $query->where('id', $user->account_id);
        }

        $account = $query->firstOrFail();

        if (!BillingAccess::canViewAccountBilling($user, $account)) {
            abort(403, 'You are not authorized to access this account billing.');
        }

        return $account;
    }

    public function buildAccountBillingSummary(Account $account): array
    {
        $account->loadMissing([
            'owner',
            'merchants.plan',
            'billingProfile.paymentGateway',
            'paymentMethods.paymentGateway',
            'invoices',
        ]);

        $countryPricing = $this->resolveCountryPricing($account);
        $currency = strtoupper($countryPricing->currency);
        [$currentPeriodStart, $currentPeriodEnd] = $this->billingPeriodForDate($account, now());
        $nextBillingDate = $this->nextBillingDateForDate($account, now());
        $freePlanAvailableUntil = $this->freePlanAvailableUntil($account);
        $invoicePreview = $this->buildInvoicePreview($account, $currentPeriodStart, $currentPeriodEnd, $currency);

        $merchants = $account->merchants()
            ->with('plan')
            ->orderBy('name')
            ->get()
            ->map(function (Merchant $merchant) use ($currency) {
                $activeVehicles = Vehicle::query()
                    ->where('account_id', $merchant->account_id)
                    ->where('merchant_id', $merchant->id)
                    ->where('is_active', true)
                    ->count();

                $plan = $merchant->plan;
                $vehicleLimit = (int) ($plan?->vehicle_limit ?? 0);
                $extraVehicles = max(0, $activeVehicles - $vehicleLimit);
                $monthlyCharge = $currency === 'ZAR'
                    ? (float) ($plan?->monthly_charge_zar ?? 0)
                    : (float) ($plan?->monthly_charge_usd ?? 0);
                $extraVehiclePrice = $currency === 'ZAR'
                    ? (float) ($plan?->extra_vehicle_price_zar ?? 0)
                    : (float) ($plan?->extra_vehicle_price_usd ?? 0);

                return [
                    'merchant_id' => $merchant->uuid,
                    'name' => $merchant->name,
                    'plan_id' => $plan?->uuid,
                    'plan_title' => $plan?->title,
                    'vehicle_limit' => $vehicleLimit,
                    'active_vehicle_count' => $activeVehicles,
                    'extra_vehicle_count' => $extraVehicles,
                    'monthly_charge' => round($monthlyCharge, 2),
                    'extra_vehicle_price' => round($extraVehiclePrice, 2),
                    'extra_vehicle_total' => round($extraVehicles * $extraVehiclePrice, 2),
                ];
            })
            ->values();

        $invoices = AccountInvoice::query()
            ->where('account_id', $account->id)
            ->latest('billing_period_start')
            ->limit(12)
            ->get();

        return [
            'account_id' => $account->uuid,
            'owner' => [
                'user_id' => $account->owner?->uuid,
                'name' => $account->owner?->name,
                'email' => $account->owner?->email,
            ],
            'country_code' => strtoupper((string) $account->country_code),
            'is_billing_exempt' => (bool) $account->is_billing_exempt,
            'currency' => $currency,
            'current_billing_period_start' => $currentPeriodStart->toDateString(),
            'current_billing_period_end' => $currentPeriodEnd->toDateString(),
            'next_billing_date' => $nextBillingDate->toDateString(),
            'can_select_free_plan' => $this->canAccountSelectFreePlan($account),
            'free_plan_available_until' => $freePlanAvailableUntil?->toDateString(),
            'current_invoice_preview' => $invoicePreview,
            'gateway' => [
                'code' => $countryPricing->paymentGateway?->code,
                'name' => $countryPricing->paymentGateway?->name,
            ],
            'billing_profile' => $account->billingProfile,
            'gateway_capabilities' => [
                'supports_card_retrieval' => $this->gatewayManager->for($countryPricing->paymentGateway?->code ?? config('billing.default_gateway'))->supportsCardRetrieval(),
                'supports_hosted_card_capture' => $this->gatewayManager->for($countryPricing->paymentGateway?->code ?? config('billing.default_gateway'))->supportsHostedCardCapture(),
            ],
            'payment_methods' => $account->paymentMethods()->with('paymentGateway')->orderByDesc('is_default')->latest()->get(),
            'merchants' => $merchants,
            'invoices' => $invoices,
        ];
    }

    public function updateMerchantPlan(Merchant $merchant, PricingPlan $plan): Merchant
    {
        if ($plan->is_free && !$this->canMerchantSelectFreePlan($merchant)) {
            throw ValidationException::withMessages([
                'plan_id' => ['The free 1 car package is only available for the first 14 days after registration.'],
            ]);
        }

        if ($plan->is_free) {
            $this->downgradeMerchantVehiclesToFreePlan($merchant);
        }

        $merchant->plan()->associate($plan);
        $merchant->save();

        return $merchant->fresh(['plan']);
    }

    public function canAccountSelectFreePlan(Account $account): bool
    {
        $plan = PricingPlan::query()
            ->where('is_active', true)
            ->where('is_free', true)
            ->orderByDesc('trial_days')
            ->first();

        if (!$plan || !$plan->trial_days) {
            return false;
        }

        return now()->lessThanOrEqualTo($this->freePlanAvailableUntil($account, $plan));
    }

    public function freePlanAvailableUntil(Account $account, ?PricingPlan $plan = null): ?Carbon
    {
        $plan ??= PricingPlan::query()
            ->where('is_active', true)
            ->where('is_free', true)
            ->orderByDesc('trial_days')
            ->first();

        if (!$plan || !$plan->trial_days) {
            return null;
        }

        return ($account->created_at ?? now())->copy()->addDays((int) $plan->trial_days)->endOfDay();
    }

    private function canMerchantSelectFreePlan(Merchant $merchant): bool
    {
        $merchant->loadMissing(['account', 'plan']);

        if ($merchant->plan?->is_free) {
            return true;
        }

        return $merchant->account ? $this->canAccountSelectFreePlan($merchant->account) : false;
    }

    private function downgradeMerchantVehiclesToFreePlan(Merchant $merchant): void
    {
        $vehicles = Vehicle::query()
            ->where('account_id', $merchant->account_id)
            ->where('merchant_id', $merchant->id)
            ->orderByDesc('is_active')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        if ($vehicles->count() <= 1) {
            return;
        }

        // Keep a single deterministic vehicle so the downgrade can complete safely.
        $vehicleToKeep = $vehicles->shift();
        $vehicles->each(fn (Vehicle $vehicle) => $vehicle->delete());
    }

    private function buildInvoicePreview(Account $account, Carbon $periodStart, Carbon $periodEnd, string $currency): array
    {
        $subtotal = 0.0;
        $lines = [];
        $merchants = $account->merchants()->with('plan')->orderBy('name')->get();

        foreach ($merchants as $merchant) {
            if (!$merchant->plan) {
                continue;
            }

            $activeVehicles = Vehicle::query()
                ->where('account_id', $account->id)
                ->where('merchant_id', $merchant->id)
                ->where('is_active', true)
                ->count();

            $vehicleLimit = (int) $merchant->plan->vehicle_limit;
            $baseAmount = $currency === 'ZAR'
                ? (float) $merchant->plan->monthly_charge_zar
                : (float) $merchant->plan->monthly_charge_usd;
            $extraVehiclePrice = $currency === 'ZAR'
                ? (float) $merchant->plan->extra_vehicle_price_zar
                : (float) $merchant->plan->extra_vehicle_price_usd;
            $extraVehicles = max(0, $activeVehicles - $vehicleLimit);

            $lines[] = [
                'type' => 'plan',
                'description' => $merchant->name . ' - ' . $merchant->plan->title,
                'quantity' => 1,
                'unit_amount' => round($baseAmount, 2),
                'subtotal' => round($baseAmount, 2),
                'included_vehicles' => $vehicleLimit,
                'billable_vehicles' => min($activeVehicles, $vehicleLimit),
                'merchant' => [
                    'merchant_id' => $merchant->uuid,
                    'name' => $merchant->name,
                ],
                'plan' => [
                    'plan_id' => $merchant->plan->uuid,
                    'title' => $merchant->plan->title,
                    'vehicle_limit' => $vehicleLimit,
                    'monthly_charge_zar' => (float) $merchant->plan->monthly_charge_zar,
                    'monthly_charge_usd' => (float) $merchant->plan->monthly_charge_usd,
                    'extra_vehicle_price_zar' => (float) $merchant->plan->extra_vehicle_price_zar,
                    'extra_vehicle_price_usd' => (float) $merchant->plan->extra_vehicle_price_usd,
                    'is_free' => (bool) $merchant->plan->is_free,
                    'trial_days' => $merchant->plan->trial_days !== null ? (int) $merchant->plan->trial_days : null,
                    'is_active' => (bool) $merchant->plan->is_active,
                    'sort_order' => $merchant->plan->sort_order,
                ],
            ];
            $subtotal += $baseAmount;

            if ($extraVehicles > 0) {
                $overageSubtotal = $extraVehicles * $extraVehiclePrice;

                $lines[] = [
                    'type' => 'overage',
                    'description' => $merchant->name . ' - Extra vehicles',
                    'quantity' => $extraVehicles,
                    'unit_amount' => round($extraVehiclePrice, 2),
                    'subtotal' => round($overageSubtotal, 2),
                    'included_vehicles' => $vehicleLimit,
                    'billable_vehicles' => $extraVehicles,
                    'merchant' => [
                        'merchant_id' => $merchant->uuid,
                        'name' => $merchant->name,
                    ],
                    'plan' => [
                        'plan_id' => $merchant->plan->uuid,
                        'title' => $merchant->plan->title,
                        'vehicle_limit' => $vehicleLimit,
                        'monthly_charge_zar' => (float) $merchant->plan->monthly_charge_zar,
                        'monthly_charge_usd' => (float) $merchant->plan->monthly_charge_usd,
                        'extra_vehicle_price_zar' => (float) $merchant->plan->extra_vehicle_price_zar,
                        'extra_vehicle_price_usd' => (float) $merchant->plan->extra_vehicle_price_usd,
                        'is_free' => (bool) $merchant->plan->is_free,
                        'trial_days' => $merchant->plan->trial_days !== null ? (int) $merchant->plan->trial_days : null,
                        'is_active' => (bool) $merchant->plan->is_active,
                        'sort_order' => $merchant->plan->sort_order,
                    ],
                ];
                $subtotal += $overageSubtotal;
            }
        }

        return [
            'billing_period_start' => $periodStart->toDateString(),
            'billing_period_end' => $periodEnd->toDateString(),
            'currency' => $currency,
            'subtotal' => round($subtotal, 2),
            'total' => round($subtotal, 2),
            'lines' => $lines,
        ];
    }

    public function savePaymentMethod(Account $account, array $data): AccountPaymentMethod
    {
        return DB::transaction(function () use ($account, $data) {
            $countryPricing = $this->resolveCountryPricing($account);
            $gateway = PaymentGateway::query()
                ->where('id', $data['payment_gateway_id'] ?? $countryPricing->payment_gateway_id)
                ->firstOrFail();

            $profile = AccountBillingProfile::firstOrNew([
                'account_id' => $account->id,
            ]);

            if (!$profile->exists) {
                $profile->uuid = (string) Str::uuid();
            }

            $profileDto = $this->gatewayManager->for($gateway->code)->ensureCustomerProfile($account, array_merge([
                'gateway_customer_id' => $profile->gateway_customer_id,
                'gateway_reference' => $profile->gateway_reference,
                'gateway_metadata' => $profile->gateway_metadata,
            ], $data));
            $syncData = $profileDto->toArray();
            $profile->fill([
                'payment_gateway_id' => $gateway->id,
                'gateway_code' => $gateway->code,
                'gateway_customer_id' => $syncData['gateway_customer_id'] ?? ($data['gateway_customer_id'] ?? null),
                'gateway_reference' => $syncData['gateway_reference'] ?? ($data['gateway_reference'] ?? null),
                'gateway_metadata' => $syncData['gateway_metadata'] ?? ($data['gateway_metadata'] ?? null),
                'last_synced_at' => now(),
            ])->save();

            if (!empty($data['is_default'])) {
                $account->paymentMethods()->update(['is_default' => false]);
            }

            $paymentMethod = new AccountPaymentMethod([
                'uuid' => (string) Str::uuid(),
                'payment_gateway_id' => $gateway->id,
                'gateway_code' => $gateway->code,
                'gateway_customer_id' => $data['gateway_customer_id'] ?? $profile->gateway_customer_id,
                'gateway_payment_method_id' => $data['gateway_payment_method_id'] ?? null,
                'gateway_reference' => $data['gateway_reference'] ?? null,
                'brand' => $data['brand'] ?? null,
                'last_four' => $data['last_four'] ?? null,
                'expiry_month' => $data['expiry_month'] ?? null,
                'expiry_year' => $data['expiry_year'] ?? null,
                'funding_type' => $data['funding_type'] ?? null,
                'bank' => $data['bank'] ?? null,
                'signature' => $data['signature'] ?? null,
                'is_reusable' => array_key_exists('is_reusable', $data) ? (bool) $data['is_reusable'] : true,
                'retrieved_from_gateway' => (bool) ($data['retrieved_from_gateway'] ?? false),
                'is_default' => (bool) ($data['is_default'] ?? false),
                'status' => $data['status'] ?? 'active',
                'verified_at' => now(),
                'gateway_metadata' => $data['gateway_metadata'] ?? null,
            ]);

            $paymentMethod->account()->associate($account);
            $paymentMethod->billingProfile()->associate($profile);
            $paymentMethod->save();

            return $paymentMethod->fresh('paymentGateway');
        });
    }

    public function setupPaymentMethodCapture(Account $account, ?PaymentGateway $gateway = null): array
    {
        $countryPricing = $this->resolveCountryPricing($account);
        $gateway ??= PaymentGateway::query()->findOrFail($countryPricing->payment_gateway_id);
        $profile = $account->billingProfile()->first();

        return $this->gatewayManager
            ->for($gateway->code)
            ->storePaymentMethodSetupIntent($account, [
                'gateway_customer_id' => $profile?->gateway_customer_id,
                'gateway_reference' => $profile?->gateway_reference,
                'gateway_metadata' => $profile?->gateway_metadata,
            ])
            ->toArray();
    }

    public function syncPaymentMethods(Account $account, ?PaymentGateway $gateway = null): array
    {
        $countryPricing = $this->resolveCountryPricing($account);
        $gateway ??= PaymentGateway::query()->findOrFail($countryPricing->payment_gateway_id);

        $collection = $this->gatewayManager->for($gateway->code)->syncCustomerPaymentCards($account);

        DB::transaction(function () use ($account, $gateway, $collection) {
            $account->paymentMethods()
                ->where('gateway_code', $gateway->code)
                ->where('retrieved_from_gateway', true)
                ->delete();

            foreach ($collection->cards as $card) {
                if (!$card instanceof PaymentCard) {
                    continue;
                }

                $existing = $account->paymentMethods()
                    ->where('gateway_code', $gateway->code)
                    ->where(function ($query) use ($card) {
                        $query->where('gateway_payment_method_id', $card->gatewayPaymentMethodId)
                            ->orWhere('signature', $card->signature)
                            ->orWhere('gateway_reference', $card->gatewayReference);
                    })
                    ->first();

                $payload = $card->toArray();
                $payload['payment_gateway_id'] = $gateway->id;
                $payload['retrieved_from_gateway'] = $collection->retrievedFromGateway;

                if ($existing) {
                    $existing->fill([
                        'gateway_customer_id' => $payload['gateway_customer_id'],
                        'gateway_payment_method_id' => $payload['gateway_payment_method_id'],
                        'gateway_reference' => $payload['gateway_reference'],
                        'brand' => $payload['brand'],
                        'last_four' => $payload['last_four'],
                        'expiry_month' => $payload['expiry_month'],
                        'expiry_year' => $payload['expiry_year'],
                        'funding_type' => $payload['funding_type'],
                        'bank' => $payload['bank'],
                        'signature' => $payload['signature'],
                        'is_reusable' => $payload['is_reusable'],
                        'status' => $payload['status'],
                        'retrieved_from_gateway' => $payload['retrieved_from_gateway'],
                        'gateway_metadata' => $payload['gateway_metadata'],
                    ])->save();
                    continue;
                }

                $this->savePaymentMethod($account, array_merge($payload, [
                    'payment_gateway_id' => $gateway->id,
                    'is_default' => false,
                ]));
            }
        });

        return [
            'gateway_code' => $collection->gatewayCode,
            'supports_card_retrieval' => $this->gatewayManager->for($gateway->code)->supportsCardRetrieval(),
            'supports_hosted_card_capture' => $this->gatewayManager->for($gateway->code)->supportsHostedCardCapture(),
            'retrieved_from_gateway' => $collection->retrievedFromGateway,
            'cards' => array_map(static fn (PaymentCard $card) => $card->toArray(), $collection->cards),
        ];
    }

    public function setDefaultPaymentMethod(Account $account, AccountPaymentMethod $paymentMethod): AccountPaymentMethod
    {
        DB::transaction(function () use ($account, $paymentMethod) {
            $account->paymentMethods()->update(['is_default' => false]);
            $paymentMethod->forceFill(['is_default' => true])->save();
        });

        return $paymentMethod->fresh('paymentGateway');
    }

    public function removePaymentMethod(AccountPaymentMethod $paymentMethod): void
    {
        $paymentMethod->delete();
    }

    public function generateInvoiceForAccount(Account $account, Carbon $periodStart, Carbon $periodEnd): AccountInvoice
    {
        return DB::transaction(function () use ($account, $periodStart, $periodEnd) {
            $countryPricing = $this->resolveCountryPricing($account);
            $currency = strtoupper($countryPricing->currency);

            $invoice = AccountInvoice::firstOrNew([
                'account_id' => $account->id,
                'billing_period_start' => $periodStart->toDateString(),
                'billing_period_end' => $periodEnd->toDateString(),
            ]);

            if (!$invoice->exists) {
                $invoice->uuid = (string) Str::uuid();
                $invoice->invoice_number = 'INV-' . strtoupper(Str::random(10));
            }

            $invoice->fill([
                'currency' => $currency,
                'invoice_status' => 'finalized',
                'payment_status' => $account->is_billing_exempt ? 'waived' : 'unpaid',
                'gateway_code' => $countryPricing->paymentGateway?->code ?? config('billing.default_gateway'),
                'due_date' => $periodEnd->copy()->addDays((int) config('billing.invoice_due_days')),
                'failure_reason' => null,
            ])->save();

            $invoice->lines()->delete();

            $subtotal = 0.0;

            $merchants = $account->merchants()->with('plan')->get();

            foreach ($merchants as $merchant) {
                if (!$merchant->plan) {
                    continue;
                }

                $activeVehicles = Vehicle::query()
                    ->where('account_id', $account->id)
                    ->where('merchant_id', $merchant->id)
                    ->where('is_active', true)
                    ->count();

                $vehicleLimit = (int) $merchant->plan->vehicle_limit;
                $extraVehicles = max(0, $activeVehicles - $vehicleLimit);
                $basePrice = $currency === 'ZAR'
                    ? (float) $merchant->plan->monthly_charge_zar
                    : (float) $merchant->plan->monthly_charge_usd;
                $extraPrice = $currency === 'ZAR'
                    ? (float) $merchant->plan->extra_vehicle_price_zar
                    : (float) $merchant->plan->extra_vehicle_price_usd;

                $baseLine = new AccountInvoiceLine([
                    'uuid' => (string) Str::uuid(),
                    'type' => 'plan',
                    'description' => sprintf('%s plan charge', $merchant->name),
                    'quantity' => 1,
                    'unit_amount' => $basePrice,
                    'subtotal' => $basePrice,
                    'included_vehicles' => $vehicleLimit,
                    'billable_vehicles' => min($activeVehicles, $vehicleLimit),
                    'snapshot' => [
                        'plan_title' => $merchant->plan->title,
                        'merchant_name' => $merchant->name,
                        'active_vehicle_count' => $activeVehicles,
                    ],
                ]);
                $baseLine->merchant()->associate($merchant);
                $baseLine->plan()->associate($merchant->plan);
                $invoice->lines()->save($baseLine);
                $subtotal += $basePrice;

                if ($extraVehicles > 0) {
                    $extraSubtotal = $extraVehicles * $extraPrice;
                    $extraLine = new AccountInvoiceLine([
                        'uuid' => (string) Str::uuid(),
                        'type' => 'extra_vehicle',
                        'description' => sprintf('%s extra vehicles', $merchant->name),
                        'quantity' => $extraVehicles,
                        'unit_amount' => $extraPrice,
                        'subtotal' => $extraSubtotal,
                        'included_vehicles' => $vehicleLimit,
                        'billable_vehicles' => $extraVehicles,
                        'snapshot' => [
                            'plan_title' => $merchant->plan->title,
                            'merchant_name' => $merchant->name,
                            'active_vehicle_count' => $activeVehicles,
                        ],
                    ]);
                    $extraLine->merchant()->associate($merchant);
                    $extraLine->plan()->associate($merchant->plan);
                    $invoice->lines()->save($extraLine);
                    $subtotal += $extraSubtotal;
                }
            }

            $invoice->forceFill([
                'subtotal' => $subtotal,
                'total' => $subtotal,
            ])->save();

            return $invoice->fresh(['lines.merchant', 'lines.plan', 'account']);
        });
    }

    public function chargeInvoice(AccountInvoice $invoice, bool $automatic = true): AccountInvoice
    {
        $invoice->loadMissing(['account.owner', 'account.paymentMethods', 'paymentAttempts']);
        $account = $invoice->account;

        if (!$account || $account->is_billing_exempt) {
            $invoice->forceFill([
                'payment_status' => 'waived',
                'paid_at' => now(),
                'last_payment_attempt_at' => now(),
            ])->save();

            return $invoice->fresh(['lines', 'paymentAttempts']);
        }

        $paymentMethod = $account->paymentMethods()->where('is_default', true)->latest()->first();

        if (!$paymentMethod) {
            $invoice->forceFill([
                'payment_status' => 'failed',
                'last_payment_attempt_at' => now(),
                'failure_reason' => 'No default payment method is available.',
            ])->save();

            return $invoice->fresh(['lines', 'paymentAttempts']);
        }

        $attempt = new AccountInvoicePaymentAttempt([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'payment_gateway_id' => $paymentMethod->payment_gateway_id,
            'payment_method_id' => $paymentMethod->id,
            'gateway_code' => $paymentMethod->gateway_code,
            'status' => 'pending',
            'amount' => $invoice->total,
            'request_payload' => ['automatic' => $automatic],
        ]);
        $invoice->paymentAttempts()->save($attempt);

        $result = $this->gatewayManager->for($paymentMethod->gateway_code ?? config('billing.default_gateway'))
            ->chargeSavedPaymentMethod($invoice, $paymentMethod)
            ->toArray();

        $attempt->forceFill([
            'status' => $result['status'] ?? ($result['success'] ? 'paid' : 'failed'),
            'provider_transaction_id' => $result['provider_transaction_id'] ?? null,
            'provider_reference' => $result['provider_reference'] ?? null,
            'response_payload' => $result['response_payload'] ?? null,
            'failure_reason' => $result['failure_reason'] ?? null,
            'processed_at' => now(),
        ])->save();

        $invoice->forceFill([
            'payment_status' => $result['success'] ? 'paid' : 'failed',
            'paid_at' => $result['success'] ? now() : null,
            'last_payment_attempt_at' => now(),
            'failure_reason' => $result['failure_reason'] ?? null,
        ])->save();

        return $invoice->fresh(['lines', 'paymentAttempts']);
    }

    public function queryAccounts(): Builder
    {
        return Account::query()->with(['owner', 'merchants.plan', 'billingProfile.paymentGateway']);
    }

    public function shouldGenerateInvoiceOnDate(Account $account, Carbon $date): bool
    {
        $anchor = ($account->created_at ?? $date)->copy();
        $billingDay = min($anchor->day, $date->copy()->endOfMonth()->day);

        return $date->day === $billingDay;
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    public function billingPeriodForDate(Account $account, Carbon $date): array
    {
        $anchor = ($account->created_at ?? $date)->copy()->startOfDay();
        $current = $date->copy()->startOfDay();

        $cycleStart = $anchor->copy();

        while (true) {
            $nextCycleStart = $this->advanceBillingCycleDate($cycleStart, $anchor->day);
            if ($nextCycleStart->gt($current)) {
                break;
            }
            $cycleStart = $nextCycleStart;
        }

        $cycleEnd = $this->advanceBillingCycleDate($cycleStart, $anchor->day)->subDay()->endOfDay();

        return [$cycleStart->copy()->startOfDay(), $cycleEnd];
    }

    public function nextBillingDateForDate(Account $account, Carbon $date): Carbon
    {
        $current = $date->copy()->startOfDay();

        if ($this->shouldGenerateInvoiceOnDate($account, $current)) {
            return $current;
        }

        [$periodStart] = $this->billingPeriodForDate($account, $current);
        $anchorDay = ($account->created_at ?? $current)->copy()->day;

        return $this->advanceBillingCycleDate($periodStart, $anchorDay);
    }

    private function advanceBillingCycleDate(Carbon $cycleStart, int $anchorDay): Carbon
    {
        $nextMonth = $cycleStart->copy()->addMonthNoOverflow()->startOfMonth();
        $day = min($anchorDay, $nextMonth->copy()->endOfMonth()->day);

        return $nextMonth->copy()->day($day)->startOfDay();
    }
}
