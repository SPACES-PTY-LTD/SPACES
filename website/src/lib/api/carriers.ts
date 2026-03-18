import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type { ApiEnvelope, ApiListResponse, Carrier } from "@/lib/types"

export async function listCarriers(
  token?: string | null,
  params?: {
    page?: number
    sort_by?: string
    sort_dir?: "asc" | "desc"
  }
) {
  return apiFetch<ApiListResponse<Carrier>>("/api/v1/carriers", {
    token,
    params,
  })
}

export async function getCarrier(carrierId: string, token?: string | null) {
  const response = await apiFetch<ApiEnvelope<Carrier>>(
    `/api/v1/carriers/${carrierId}`,
    { token }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function createCarrier(
  payload: Partial<Carrier>,
  token?: string | null
) {
  return apiFetch<Carrier>("/api/v1/carriers", {
    method: "POST",
    body: payload,
    token,
  })
}

export async function updateCarrier(
  carrierId: string,
  payload: Partial<Carrier>,
  token?: string | null
) {
  return apiFetch<Carrier>(`/api/v1/carriers/${carrierId}`, {
    method: "PATCH",
    body: payload,
    token,
  })
}

export async function deleteCarrier(carrierId: string, token?: string | null) {
  return apiFetch<void>(`/api/v1/carriers/${carrierId}`, {
    method: "DELETE",
    token,
  })
}
