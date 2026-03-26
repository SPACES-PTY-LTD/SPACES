<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\CountryPricing;
use App\Models\Merchant;
use App\Models\PaymentGateway;
use App\Models\PricingPlan;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\BillingService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class BillingTest extends TestCase
{
    use RefreshDatabase;

    public function test_billing_summary_uses_account_country_and_merchant_vehicle_overages(): void
    {
        [$user, $account, $merchant, $plan] = $this->seedBillingContext();
        $token = $user->createToken('test')->plainTextToken;

        Vehicle::query()->create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => 'AAA111',
            'is_active' => true,
        ]);
        Vehicle::query()->create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => 'BBB222',
            'is_active' => true,
        ]);
        Vehicle::query()->create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => 'CCC333',
            'is_active' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)->getJson('/api/v1/billing/summary');

        $response->assertOk()
            ->assertJsonPath('data.country_code', 'ZA')
            ->assertJsonPath('data.currency', 'ZAR')
            ->assertJsonPath('data.next_billing_date', now()->toDateString())
            ->assertJsonPath('data.gateway.code', 'payfast')
            ->assertJsonPath('data.current_invoice_preview.currency', 'ZAR')
            ->assertJsonPath('data.current_invoice_preview.lines.0.description', $merchant->name . ' - ' . $plan->title)
            ->assertJsonPath('data.current_invoice_preview.total', 9300)
            ->assertJsonPath('data.merchants.0.plan_title', $plan->title)
            ->assertJsonPath('data.merchants.0.active_vehicle_count', 3)
            ->assertJsonPath('data.merchants.0.extra_vehicle_count', 1);
    }

    public function test_generates_invoice_and_stores_payment_method(): void
    {
        [$user, $account, $merchant, $plan, $gateways] = $this->seedBillingContext();
        $token = $user->createToken('test')->plainTextToken;

        Vehicle::query()->create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => 'AAA111',
            'is_active' => true,
        ]);
        Vehicle::query()->create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => 'BBB222',
            'is_active' => true,
        ]);
        Vehicle::query()->create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => 'CCC333',
            'is_active' => true,
        ]);

        /** @var BillingService $service */
        $service = app(BillingService::class);
        [$periodStart, $periodEnd] = $service->billingPeriodForDate($account, now());
        $invoice = $service->generateInvoiceForAccount($account, $periodStart, $periodEnd);

        $this->assertDatabaseHas('account_invoices', [
            'id' => $invoice->id,
            'currency' => 'ZAR',
            'payment_status' => 'unpaid',
        ]);
        $this->assertSame($periodStart->toDateString(), $invoice->billing_period_start->toDateString());
        $this->assertSame($periodEnd->toDateString(), $invoice->billing_period_end->toDateString());
        $this->assertDatabaseCount('account_invoice_lines', 2);

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)->postJson('/api/v1/billing/payment-methods', [
            'payment_gateway_id' => $gateways['payfast']->uuid,
            'gateway_customer_id' => 'cust_001',
            'gateway_payment_method_id' => 'pm_001',
            'gateway_reference' => 'token_001',
            'brand' => 'visa',
            'last_four' => '4242',
            'expiry_month' => 12,
            'expiry_year' => 2030,
            'is_default' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.gateway_code', 'payfast')
            ->assertJsonPath('data.last_four', '4242')
            ->assertJsonPath('data.is_default', true);

        $this->assertDatabaseHas('account_payment_methods', [
            'account_id' => $account->id,
            'gateway_code' => 'payfast',
            'last_four' => '4242',
            'is_default' => true,
        ]);
    }

    public function test_sync_payment_methods_returns_masked_gateway_cards_without_raw_card_storage(): void
    {
        [$user, $account, , , $gateways] = $this->seedBillingContext();
        $token = $user->createToken('test')->plainTextToken;

        $service = app(BillingService::class);
        $service->savePaymentMethod($account, [
            'payment_gateway_id' => $gateways['payfast']->id,
            'gateway_customer_id' => 'cust_001',
            'gateway_payment_method_id' => 'pm_001',
            'gateway_reference' => 'token_001',
            'brand' => 'visa',
            'last_four' => '4242',
            'expiry_month' => 12,
            'expiry_year' => 2030,
            'funding_type' => 'credit',
            'bank' => 'Demo Bank',
            'signature' => 'sig_001',
            'is_reusable' => true,
            'retrieved_from_gateway' => false,
            'is_default' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/billing/payment-methods/sync', [
                'payment_gateway_id' => $gateways['payfast']->uuid,
            ]);

        $response->assertOk()
            ->assertJsonPath('data.gateway_code', 'payfast')
            ->assertJsonPath('data.supports_card_retrieval', false)
            ->assertJsonPath('data.cards.0.last_four', '4242')
            ->assertJsonPath('data.cards.0.bank', 'Demo Bank')
            ->assertJsonPath('data.cards.0.retrieved_from_gateway', false);
    }

    public function test_billing_period_tracks_account_registration_anniversary(): void
    {
        [, $account] = $this->seedBillingContext(createdAt: '2026-01-15 10:00:00');

        /** @var BillingService $service */
        $service = app(BillingService::class);
        [$periodStart, $periodEnd] = $service->billingPeriodForDate($account, now()->setDate(2026, 3, 15));

        $this->assertTrue($service->shouldGenerateInvoiceOnDate($account, now()->setDate(2026, 3, 15)));
        $this->assertFalse($service->shouldGenerateInvoiceOnDate($account, now()->setDate(2026, 3, 14)));
        $this->assertSame('2026-03-15', $periodStart->toDateString());
        $this->assertSame('2026-04-14', $periodEnd->toDateString());
    }

    public function test_billing_period_uses_month_end_when_anniversary_day_does_not_exist(): void
    {
        [, $account] = $this->seedBillingContext(createdAt: '2026-01-31 09:00:00');

        /** @var BillingService $service */
        $service = app(BillingService::class);
        [$periodStart, $periodEnd] = $service->billingPeriodForDate($account, now()->setDate(2026, 2, 28));

        $this->assertTrue($service->shouldGenerateInvoiceOnDate($account, now()->setDate(2026, 2, 28)));
        $this->assertSame('2026-02-28', $periodStart->toDateString());
        $this->assertSame('2026-03-30', $periodEnd->toDateString());
    }

    public function test_account_billing_plan_list_hides_free_plan_after_trial_window(): void
    {
        [$user, $account] = $this->seedBillingContext(createdAt: now()->subDays(20)->toDateTimeString());
        $token = $user->createToken('test')->plainTextToken;

        PricingPlan::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Free 1 Car',
            'vehicle_limit' => 1,
            'monthly_charge_zar' => 0,
            'monthly_charge_usd' => 0,
            'extra_vehicle_price_zar' => 0,
            'extra_vehicle_price_usd' => 0,
            'is_free' => true,
            'trial_days' => 14,
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)->getJson('/api/v1/billing/plans');

        $response->assertOk();
        $this->assertSame([], array_values(array_filter(
            $response->json('data'),
            fn (array $plan) => (bool) ($plan['is_free'] ?? false)
        )));
        $this->assertFalse(app(BillingService::class)->canAccountSelectFreePlan($account));
    }

    public function test_downgrading_to_free_plan_keeps_one_vehicle_and_deletes_the_rest(): void
    {
        [$user, $account, $merchant] = $this->seedBillingContext();
        $token = $user->createToken('test')->plainTextToken;

        $freePlan = PricingPlan::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Free 1 Car',
            'vehicle_limit' => 1,
            'monthly_charge_zar' => 0,
            'monthly_charge_usd' => 0,
            'extra_vehicle_price_zar' => 0,
            'extra_vehicle_price_usd' => 0,
            'is_free' => true,
            'trial_days' => 14,
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $firstVehicle = Vehicle::query()->create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => 'AAA111',
            'is_active' => true,
        ]);
        Vehicle::query()->create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => 'BBB222',
            'is_active' => true,
        ]);
        Vehicle::query()->create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => 'CCC333',
            'is_active' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->patchJson("/api/v1/billing/merchants/{$merchant->uuid}/plan", [
                'plan_id' => $freePlan->uuid,
            ]);

        $response->assertOk()
            ->assertJsonPath('data.plan.plan_id', $freePlan->uuid);

        $this->assertDatabaseHas('merchants', [
            'id' => $merchant->id,
            'plan_id' => $freePlan->id,
        ]);
        $this->assertSame(1, Vehicle::query()->where('merchant_id', $merchant->id)->count());
        $this->assertDatabaseHas('vehicles', [
            'id' => $firstVehicle->id,
            'deleted_at' => null,
        ]);
        $this->assertSame(2, Vehicle::onlyTrashed()->where('merchant_id', $merchant->id)->count());
    }

    private function seedBillingContext(?string $createdAt = null): array
    {
        $user = User::factory()->create([
            'role' => 'user',
        ]);

        $account = Account::query()->create([
            'uuid' => (string) Str::uuid(),
            'owner_user_id' => $user->id,
            'country_code' => 'ZA',
            'is_billing_exempt' => false,
        ]);

        if ($createdAt) {
            $timestamp = Carbon::parse($createdAt);
            $account->forceFill([
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ])->save();
            $account->refresh();
        }

        $user->forceFill(['account_id' => $account->id])->save();

        $gateways = [
            'free' => PaymentGateway::query()->create([
                'uuid' => (string) Str::uuid(),
                'code' => 'free',
                'name' => 'Free',
                'type' => 'free',
                'is_active' => true,
                'sort_order' => 0,
            ]),
            'payfast' => PaymentGateway::query()->create([
                'uuid' => (string) Str::uuid(),
                'code' => 'payfast',
                'name' => 'PayFast',
                'type' => 'card',
                'is_active' => true,
                'sort_order' => 10,
            ]),
        ];

        CountryPricing::query()->create([
            'uuid' => (string) Str::uuid(),
            'country_name' => 'South Africa',
            'country_code' => 'ZA',
            'currency' => 'ZAR',
            'payment_gateway_id' => $gateways['payfast']->id,
            'is_default' => false,
        ]);
        CountryPricing::query()->create([
            'uuid' => (string) Str::uuid(),
            'country_name' => 'Rest of world',
            'country_code' => 'US',
            'currency' => 'USD',
            'payment_gateway_id' => $gateways['free']->id,
            'is_default' => true,
        ]);

        $plan = PricingPlan::query()->create([
            'uuid' => (string) Str::uuid(),
            'title' => 'Starter',
            'vehicle_limit' => 2,
            'monthly_charge_zar' => 9000,
            'monthly_charge_usd' => 499,
            'extra_vehicle_price_zar' => 300,
            'extra_vehicle_price_usd' => 20,
            'is_free' => false,
            'trial_days' => null,
            'is_active' => true,
            'sort_order' => 10,
        ]);

        $merchant = Merchant::factory()->create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
            'plan_id' => $plan->id,
        ]);

        return [$user, $account, $merchant, $plan, $gateways];
    }
}
