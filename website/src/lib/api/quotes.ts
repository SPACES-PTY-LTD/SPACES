import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type {
  ApiEnvelope,
  ApiListResponse,
  CreateQuotePayload,
  Quote,
} from "@/lib/types"

export async function createQuote(
  payload: CreateQuotePayload,
  token?: string | null
) {
  return apiFetch<Quote>("/api/v1/quotes", {
    method: "POST",
    body: payload,
    token,
  })
}

export async function getQuote(
  quoteId: string,
  token?: string | null,
  params?: { merchant_id?: string }
) {
  const response = await apiFetch<ApiEnvelope<Quote>>(
    `/api/v1/quotes/${quoteId}`,
    { token, params }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function getShipmentQuotes(
  token?: string | null,
  params?: {
    merchant_id?: string
    page?: number
    sort_by?: string
    sort_dir?: "asc" | "desc"
  }
) {
  return apiFetch<ApiListResponse<Quote>>(
    `/api/v1/quotes`,
    { token, params }
  )
}
