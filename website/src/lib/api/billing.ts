import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type {
  ApiEnvelope,
  ApiListResponse,
  BillingInvoice,
  BillingPaymentMethod,
  BillingPaymentMethodSetupIntent,
  BillingPaymentMethodSyncResult,
  BillingSummary,
  CountryPricing,
  PaymentGateway,
  PricingPlan,
} from "@/lib/types"

export async function getBillingSummary(token?: string | null) {
  const response = await apiFetch<ApiEnvelope<BillingSummary>>("/api/v1/billing/summary", { token })
  if (isApiErrorResponse(response)) return response
  return response.data
}

export async function listBillingInvoices(token?: string | null, params?: { page?: number; per_page?: number }) {
  return apiFetch<ApiListResponse<BillingInvoice>>("/api/v1/billing/invoices", { token, params })
}

export async function getBillingInvoice(invoiceId: string, token?: string | null) {
  const response = await apiFetch<ApiEnvelope<BillingInvoice>>(`/api/v1/billing/invoices/${invoiceId}`, { token })
  if (isApiErrorResponse(response)) return response
  return response.data
}

export async function listBillingPlans(token?: string | null) {
  const response = await apiFetch<ApiEnvelope<PricingPlan[]>>("/api/v1/billing/plans", { token })
  if (isApiErrorResponse(response)) return response
  return response.data
}

export async function listBillingGateways(token?: string | null) {
  const response = await apiFetch<ApiEnvelope<PaymentGateway[]>>("/api/v1/billing/gateways", { token })
  if (isApiErrorResponse(response)) return response
  return response.data
}

export async function updateMerchantBillingPlan(merchantId: string, planId: string, token?: string | null) {
  return apiFetch<ApiEnvelope<{ merchant_id: string; plan: PricingPlan | null }>>(`/api/v1/billing/merchants/${merchantId}/plan`, {
    method: "PATCH",
    token,
    body: { plan_id: planId },
  })
}

export async function storeBillingPaymentMethod(
  payload: {
    payment_gateway_id?: string
    gateway_customer_id?: string
    gateway_payment_method_id?: string
    gateway_reference?: string
    brand?: string
    last_four?: string
    expiry_month?: number
    expiry_year?: number
    is_default?: boolean
  },
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<BillingPaymentMethod>>("/api/v1/billing/payment-methods", {
    method: "POST",
    body: payload,
    token,
  })
  if (isApiErrorResponse(response)) return response
  return response.data
}

export async function setupBillingPaymentMethod(
  payload: { payment_gateway_id?: string },
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<BillingPaymentMethodSetupIntent>>("/api/v1/billing/payment-methods/setup", {
    method: "POST",
    body: payload,
    token,
  })
  if (isApiErrorResponse(response)) return response
  return response.data
}

export async function syncBillingPaymentMethods(
  payload: { payment_gateway_id?: string },
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<BillingPaymentMethodSyncResult>>("/api/v1/billing/payment-methods/sync", {
    method: "POST",
    body: payload,
    token,
  })
  if (isApiErrorResponse(response)) return response
  return response.data
}

export async function setDefaultBillingPaymentMethod(paymentMethodId: string, token?: string | null) {
  const response = await apiFetch<ApiEnvelope<BillingPaymentMethod>>(`/api/v1/billing/payment-methods/${paymentMethodId}/default`, {
    method: "PATCH",
    token,
  })
  if (isApiErrorResponse(response)) return response
  return response.data
}

export async function deleteBillingPaymentMethod(paymentMethodId: string, token?: string | null) {
  return apiFetch<ApiEnvelope<{ message: string }>>(`/api/v1/billing/payment-methods/${paymentMethodId}`, {
    method: "DELETE",
    token,
  })
}

export async function chargeBillingInvoice(invoiceId: string, token?: string | null) {
  const response = await apiFetch<ApiEnvelope<BillingInvoice>>(`/api/v1/billing/invoices/${invoiceId}/charge`, {
    method: "POST",
    token,
  })
  if (isApiErrorResponse(response)) return response
  return response.data
}

export async function listAdminBillingGateways(token?: string | null) {
  const response = await apiFetch<ApiEnvelope<PaymentGateway[]>>("/api/v1/admin/billing/gateways", { token })
  if (isApiErrorResponse(response)) return response
  return response.data
}

export async function listAdminCountryPricing(token?: string | null) {
  const response = await apiFetch<ApiEnvelope<CountryPricing[]>>("/api/v1/admin/billing/country-pricing", { token })
  if (isApiErrorResponse(response)) return response
  return response.data
}

export async function listAdminPricingPlans(token?: string | null) {
  const response = await apiFetch<ApiEnvelope<PricingPlan[]>>("/api/v1/admin/billing/plans", { token })
  if (isApiErrorResponse(response)) return response
  return response.data
}

export async function listAdminBillingAccounts(token?: string | null, params?: { page?: number; per_page?: number }) {
  return apiFetch<ApiListResponse<BillingSummary>>("/api/v1/admin/billing/accounts", { token, params })
}
