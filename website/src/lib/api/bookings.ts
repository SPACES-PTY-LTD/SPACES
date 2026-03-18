import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type { ApiEnvelope, ApiListResponse, Booking } from "@/lib/types"

export async function bookShipment(shipmentId: string, token?: string | null) {
  return apiFetch<Booking>(`/api/v1/shipments/${shipmentId}/book`, {
    method: "POST",
    token,
  })
}

export async function getBooking(
  bookingId: string,
  token?: string | null,
  params?: { merchant_id?: string }
) {
  const response = await apiFetch<ApiEnvelope<Booking>>(
    `/api/v1/bookings/${bookingId}`,
    { token, params }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function cancelShipment(
  shipmentId: string,
  payload: { reason_code: string; reason_note?: string | null },
  token?: string | null
) {
  return apiFetch<void>(`/api/v1/shipments/${shipmentId}/cancel`, {
    method: "POST",
    body: payload,
    token,
  })
}

export async function listBookings(
  token?: string | null,
  role?: string | null,
  params?: {
    merchant_id?: string
    page?: number
    sort_by?: string
    sort_dir?: "asc" | "desc"
  }
) {
  let url = "/api/v1/bookings"
  if (role === "super_admin") {
    url = "/api/v1/admin/bookings";
  }
  return apiFetch<ApiListResponse<Booking>>(url, { token, params })
}

export async function assignDriver(bookingId: string, token?: string | null) {
  return apiFetch<void>(
    `/api/v1/admin/bookings/${bookingId}/assign-driver`,
    { method: "POST", token }
  )
}

export async function unassignDriver(bookingId: string, token?: string | null) {
  return apiFetch<void>(
    `/api/v1/admin/bookings/${bookingId}/unassign-driver`,
    { method: "POST", token }
  )
}
