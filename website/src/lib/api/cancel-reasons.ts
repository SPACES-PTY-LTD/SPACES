import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type { ApiEnvelope, ApiListResponse, CancelReason } from "@/lib/types"

export async function listCancelReasons(
  token?: string | null,
  params?: { page?: number }
) {
  return apiFetch<ApiListResponse<CancelReason>>(
    "/api/v1/cancel-reasons",
    { token, params }
  )
}

export async function listPublicCancelReasons(token?: string | null) {
  return apiFetch<ApiListResponse<CancelReason>>("/api/v1/cancel-reasons", {
    token,
  })
}

export async function getCancelReason(
  cancelReasonId: string,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<CancelReason>>(
    `/api/v1/cancel-reasons/${cancelReasonId}`,
    { token }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function createCancelReason(
  payload: Partial<CancelReason>,
  token?: string | null
) {
  return apiFetch<CancelReason>("/api/v1/cancel-reasons", {
    method: "POST",
    body: payload,
    token,
  })
}

export async function updateCancelReason(
  cancelReasonId: string,
  payload: Partial<CancelReason>,
  token?: string | null
) {
  return apiFetch<CancelReason>(
    `/api/v1/cancel-reasons/${cancelReasonId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    }
  )
}

export async function deleteCancelReason(
  cancelReasonId: string,
  token?: string | null
) {
  return apiFetch<void>(
    `/api/v1/admin/cancel-reasons/${cancelReasonId}`,
    { method: "DELETE", token }
  )
}
