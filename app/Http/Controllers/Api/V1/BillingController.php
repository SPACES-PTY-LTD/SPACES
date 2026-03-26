<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAccountPaymentMethodRequest;
use App\Http\Requests\BillingGatewayActionRequest;
use App\Http\Requests\UpdateMerchantBillingPlanRequest;
use App\Http\Resources\AccountBillingSummaryResource;
use App\Http\Resources\AccountInvoiceResource;
use App\Http\Resources\AccountPaymentMethodResource;
use App\Http\Resources\PaymentGatewayResource;
use App\Http\Resources\PaymentMethodSetupIntentResource;
use App\Http\Resources\PaymentMethodSyncResource;
use App\Http\Resources\PricingPlanResource;
use App\Models\AccountInvoice;
use App\Models\AccountPaymentMethod;
use App\Models\Merchant;
use App\Models\PricingPlan;
use App\Services\BillingService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class BillingController extends Controller
{
    public function summary(Request $request, BillingService $service)
    {
        try {
            $account = $service->getBillingAccountForUser($request->user());

            return ApiResponse::success(new AccountBillingSummaryResource(
                $service->buildAccountBillingSummary($account)
            ));
        } catch (Throwable $e) {
            Log::error('Billing summary fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'BILLING_SUMMARY_FETCH_FAILED', 'Unable to load billing summary.');
        }
    }

    public function invoices(Request $request, BillingService $service)
    {
        try {
            $account = $service->getBillingAccountForUser($request->user());
            $invoices = $service->listAccountInvoices($account, (int) $request->integer('per_page', 15));

            return ApiResponse::paginated($invoices, AccountInvoiceResource::collection($invoices));
        } catch (Throwable $e) {
            Log::error('Billing invoice list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'BILLING_INVOICE_LIST_FAILED', 'Unable to list billing invoices.');
        }
    }

    public function showInvoice(Request $request, string $invoice_uuid, BillingService $service)
    {
        try {
            $account = $service->getBillingAccountForUser($request->user());
            $invoice = AccountInvoice::query()
                ->with(['lines.merchant', 'lines.plan', 'paymentAttempts'])
                ->where('account_id', $account->id)
                ->where('uuid', $invoice_uuid)
                ->firstOrFail();

            return ApiResponse::success(new AccountInvoiceResource($invoice));
        } catch (Throwable $e) {
            Log::error('Billing invoice fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'BILLING_INVOICE_FETCH_FAILED', 'Unable to load billing invoice.', Response::HTTP_NOT_FOUND);
        }
    }

    public function listPlans(BillingService $service)
    {
        try {
            $account = $service->getBillingAccountForUser(request()->user());

            return ApiResponse::success(PricingPlanResource::collection($service->listPricingPlansForAccount($account)));
        } catch (Throwable $e) {
            Log::error('Billing plans fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'BILLING_PLANS_FETCH_FAILED', 'Unable to load pricing plans.');
        }
    }

    public function listGateways(BillingService $service)
    {
        try {
            return ApiResponse::success(PaymentGatewayResource::collection($service->listPaymentGateways()->where('is_active', true)->values()));
        } catch (Throwable $e) {
            Log::error('Billing gateways fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'BILLING_GATEWAYS_FETCH_FAILED', 'Unable to load billing gateways.');
        }
    }

    public function setupPaymentMethod(BillingGatewayActionRequest $request, BillingService $service)
    {
        try {
            $account = $service->getBillingAccountForUser($request->user());
            $this->authorize('manageBilling', $account);

            $gateway = null;
            if ($request->filled('payment_gateway_id')) {
                $gateway = \App\Models\PaymentGateway::query()
                    ->where('uuid', $request->validated()['payment_gateway_id'])
                    ->firstOrFail();
            }

            return ApiResponse::success(new PaymentMethodSetupIntentResource(
                $service->setupPaymentMethodCapture($account, $gateway)
            ));
        } catch (Throwable $e) {
            Log::error('Payment method setup bootstrap failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'PAYMENT_METHOD_SETUP_FAILED', 'Unable to prepare payment method setup.');
        }
    }

    public function syncPaymentMethods(BillingGatewayActionRequest $request, BillingService $service)
    {
        try {
            $account = $service->getBillingAccountForUser($request->user());
            $this->authorize('manageBilling', $account);

            $gateway = null;
            if ($request->filled('payment_gateway_id')) {
                $gateway = \App\Models\PaymentGateway::query()
                    ->where('uuid', $request->validated()['payment_gateway_id'])
                    ->firstOrFail();
            }

            return ApiResponse::success(new PaymentMethodSyncResource(
                $service->syncPaymentMethods($account, $gateway)
            ));
        } catch (Throwable $e) {
            Log::error('Payment method sync failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'PAYMENT_METHOD_SYNC_FAILED', 'Unable to sync payment methods.');
        }
    }

    public function updateMerchantPlan(UpdateMerchantBillingPlanRequest $request, string $merchant_uuid, BillingService $service)
    {
        try {
            $account = $service->getBillingAccountForUser($request->user());
            $this->authorize('manageBilling', $account);

            $merchant = Merchant::query()
                ->where('account_id', $account->id)
                ->where('uuid', $merchant_uuid)
                ->firstOrFail();
            $plan = PricingPlan::query()->where('uuid', $request->validated()['plan_id'])->firstOrFail();

            $merchant = $service->updateMerchantPlan($merchant, $plan);

            return ApiResponse::success([
                'merchant_id' => $merchant->uuid,
                'plan' => new PricingPlanResource($merchant->plan),
            ]);
        } catch (Throwable $e) {
            Log::error('Merchant billing plan update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_BILLING_PLAN_UPDATE_FAILED', 'Unable to update merchant billing plan.');
        }
    }

    public function storePaymentMethod(StoreAccountPaymentMethodRequest $request, BillingService $service)
    {
        try {
            $account = $service->getBillingAccountForUser($request->user());
            $this->authorize('manageBilling', $account);

            $data = $request->validated();
            if (!empty($data['payment_gateway_id'])) {
                $data['payment_gateway_id'] = \App\Models\PaymentGateway::query()
                    ->where('uuid', $data['payment_gateway_id'])
                    ->value('id');
            }

            $paymentMethod = $service->savePaymentMethod($account, $data);

            return ApiResponse::success(new AccountPaymentMethodResource($paymentMethod), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Payment method save failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'PAYMENT_METHOD_SAVE_FAILED', 'Unable to save payment method.');
        }
    }

    public function setDefaultPaymentMethod(Request $request, string $payment_method_uuid, BillingService $service)
    {
        try {
            $account = $service->getBillingAccountForUser($request->user());
            $this->authorize('manageBilling', $account);

            $paymentMethod = AccountPaymentMethod::query()
                ->where('account_id', $account->id)
                ->where('uuid', $payment_method_uuid)
                ->firstOrFail();

            return ApiResponse::success(new AccountPaymentMethodResource(
                $service->setDefaultPaymentMethod($account, $paymentMethod)
            ));
        } catch (Throwable $e) {
            Log::error('Payment method default failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'PAYMENT_METHOD_DEFAULT_FAILED', 'Unable to update default payment method.');
        }
    }

    public function destroyPaymentMethod(Request $request, string $payment_method_uuid, BillingService $service)
    {
        try {
            $account = $service->getBillingAccountForUser($request->user());
            $this->authorize('manageBilling', $account);

            $paymentMethod = AccountPaymentMethod::query()
                ->where('account_id', $account->id)
                ->where('uuid', $payment_method_uuid)
                ->firstOrFail();

            $service->removePaymentMethod($paymentMethod);

            return ApiResponse::success(['message' => 'Payment method removed.']);
        } catch (Throwable $e) {
            Log::error('Payment method delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'PAYMENT_METHOD_DELETE_FAILED', 'Unable to delete payment method.');
        }
    }

    public function chargeInvoice(Request $request, string $invoice_uuid, BillingService $service)
    {
        try {
            $account = $service->getBillingAccountForUser($request->user());
            $this->authorize('manageBilling', $account);

            $invoice = AccountInvoice::query()
                ->where('account_id', $account->id)
                ->where('uuid', $invoice_uuid)
                ->firstOrFail();

            $invoice = $service->chargeInvoice($invoice, false);

            return ApiResponse::success(new AccountInvoiceResource($invoice->load(['lines.merchant', 'lines.plan', 'paymentAttempts'])));
        } catch (Throwable $e) {
            Log::error('Manual invoice charge failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'BILLING_CHARGE_FAILED', 'Unable to charge invoice.');
        }
    }
}
