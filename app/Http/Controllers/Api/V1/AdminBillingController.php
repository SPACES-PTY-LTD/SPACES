<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AccountBillingSummaryResource;
use App\Http\Resources\CountryPricingResource;
use App\Http\Resources\PaymentGatewayResource;
use App\Http\Resources\PricingPlanResource;
use App\Services\BillingService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class AdminBillingController extends Controller
{
    public function gateways(BillingService $service)
    {
        try {
            return ApiResponse::success(PaymentGatewayResource::collection($service->listPaymentGateways()));
        } catch (Throwable $e) {
            Log::error('Admin billing gateways fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_BILLING_GATEWAYS_FETCH_FAILED', 'Unable to load billing gateways.');
        }
    }

    public function countryPricing(BillingService $service)
    {
        try {
            return ApiResponse::success(CountryPricingResource::collection($service->listCountryPricing()));
        } catch (Throwable $e) {
            Log::error('Admin country pricing fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_COUNTRY_PRICING_FETCH_FAILED', 'Unable to load country pricing.');
        }
    }

    public function plans(BillingService $service)
    {
        try {
            return ApiResponse::success(PricingPlanResource::collection($service->listPricingPlans()));
        } catch (Throwable $e) {
            Log::error('Admin pricing plans fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_PRICING_PLANS_FETCH_FAILED', 'Unable to load pricing plans.');
        }
    }

    public function accounts(Request $request, BillingService $service)
    {
        try {
            $accounts = $service->queryAccounts()->paginate((int) $request->integer('per_page', 15));

            return ApiResponse::paginated($accounts, AccountBillingSummaryResource::collection(
                $accounts->getCollection()->map(fn ($account) => $service->buildAccountBillingSummary($account))
            ));
        } catch (Throwable $e) {
            Log::error('Admin billing accounts fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_BILLING_ACCOUNTS_FETCH_FAILED', 'Unable to load billing accounts.');
        }
    }

    public function showAccount(Request $request, string $account_uuid, BillingService $service)
    {
        try {
            $account = $service->getBillingAccountForUser($request->user(), $account_uuid);

            return ApiResponse::success(new AccountBillingSummaryResource(
                $service->buildAccountBillingSummary($account)
            ));
        } catch (Throwable $e) {
            Log::error('Admin billing account fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_BILLING_ACCOUNT_FETCH_FAILED', 'Unable to load billing account.');
        }
    }
}
