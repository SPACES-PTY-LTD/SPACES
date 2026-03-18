import { apiFetch } from "@/lib/api/client"
import type {
  ApiEnvelope,
  ApiListResponse,
  WebhookDelivery,
  WebhookSubscription,
} from "@/lib/types"

export async function listWebhookSubscriptions(
  token?: string | null,
  params?: { page?: number; merchant_id?: string }
) {
  return apiFetch<ApiListResponse<WebhookSubscription>>(
    "/api/v1/webhooks/subscriptions",
    { token, params }
  )
}

export async function createWebhookSubscription(
  payload: Partial<WebhookSubscription>,
  token?: string | null
) {
  return apiFetch<WebhookSubscription>("/api/v1/webhooks/subscriptions", {
    method: "POST",
    body: payload,
    token,
  })
}

export async function deleteWebhookSubscription(
  subscriptionId: string,
  token?: string | null
) {
  return apiFetch<void>(
    `/api/v1/webhooks/subscriptions/${subscriptionId}`,
    { method: "DELETE", token }
  )
}

export async function updateWebhookSubscription(
  subscriptionId: string,
  payload: Partial<WebhookSubscription>,
  token?: string | null
) {
  return apiFetch<WebhookSubscription>(
    `/api/v1/webhooks/subscriptions/${subscriptionId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    }
  )
}

export async function testWebhookSubscription(
  subscriptionId: string,
  token?: string | null
) {
  return apiFetch<void>(
    `/api/v1/webhooks/subscriptions/${subscriptionId}/test`,
    { method: "POST", token }
  )
}

export async function listWebhookDeliveries(
  token?: string | null,
  params?: { page?: number }
) {
  return apiFetch<ApiListResponse<WebhookDelivery>>(
    "/api/v1/admin/webhook-deliveries",
    { token, params }
  )
}

export async function getWebhookSubscription(
  subscriptionId: string,
  token?: string | null,
  params?: { page?: number; per_page?: number; merchant_id?: string }
) {
  return apiFetch<
    ApiEnvelope<{
      subscription: WebhookSubscription
      deliveries: WebhookDelivery[]
    }>
  >(`/api/v1/webhooks/subscriptions/${subscriptionId}`, {
    token,
    params,
  })
}

export async function sendCarrierWebhookDummy(token?: string | null) {
  return apiFetch<void>("/api/v1/webhooks/carriers/dummy", {
    method: "POST",
    token,
  })
}
