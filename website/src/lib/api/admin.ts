import { apiFetch } from "@/lib/api/client"
import type { ApiListResponse, Merchant, Shipment, User, WebhookDelivery } from "@/lib/types"

export async function listAdminUsers(
  token?: string | null,
  params?: {
    page?: number
    sort_by?: string
    sort_dir?: "asc" | "desc"
  }
) {
  return apiFetch<ApiListResponse<User>>("/api/v1/admin/users", {
    token,
    params,
  })
}

export async function listAdminMerchants(token?: string | null) {
  return apiFetch<ApiListResponse<Merchant>>("/api/v1/admin/merchants", { token })
}

export async function listAdminShipments(token?: string | null) {
  return apiFetch<ApiListResponse<Shipment>>("/api/v1/admin/shipments", { token })
}

export async function listAdminWebhookDeliveries(token?: string | null) {
  return apiFetch<ApiListResponse<WebhookDelivery>>(
    "/api/v1/admin/webhook-deliveries",
    { token }
  )
}
