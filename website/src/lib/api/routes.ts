import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type { ApiEnvelope, ApiListResponse, Route, RouteStats } from "@/lib/types"

export type RouteStopPayload = {
  location_id: string
  sequence: number
}

export type RoutePayload = {
  merchant_id?: string
  title: string
  code?: string | null
  description?: string | null
  estimated_distance?: number | null
  estimated_duration?: number | null
  estimated_collection_time?: number | null
  estimated_delivery_time?: number | null
  stops?: RouteStopPayload[]
}

type RouteListMeta = ApiListResponse<Route>["meta"] & {
  request_id?: string
  pagination?: ApiListResponse<Route>["meta"]
}

type RoutesResponse = ApiEnvelope<Route[]> & {
  data: Route[]
  meta?: RouteListMeta
}

export async function listRoutes(
  token?: string | null,
  params?: {
    merchant_id?: string
    page?: number
    per_page?: number
    search?: string
    sort_by?: string
    sort_dir?: "asc" | "desc"
  }
) {
  return apiFetch<RoutesResponse>("/api/v1/routes", {
    token,
    params,
  })
}

export async function getRoute(
  routeId: string,
  token?: string | null,
  params?: { merchant_id?: string }
) {
  const response = await apiFetch<ApiEnvelope<Route>>(`/api/v1/routes/${routeId}`, {
    token,
    params,
  })
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function createRoute(payload: RoutePayload, token?: string | null) {
  return apiFetch<Route>("/api/v1/routes", {
    method: "POST",
    body: payload,
    token,
  })
}

export async function updateRoute(
  routeId: string,
  payload: Partial<RoutePayload>,
  token?: string | null
) {
  return apiFetch<Route>(`/api/v1/routes/${routeId}`, {
    method: "PATCH",
    body: payload,
    token,
  })
}

export async function deleteRoute(routeId: string, token?: string | null) {
  return apiFetch<void>(`/api/v1/routes/${routeId}`, {
    method: "DELETE",
    token,
  })
}

export async function getRouteStats(
  routeId: string,
  token?: string | null,
  params?: { merchant_id?: string; from?: string; to?: string }
) {
  const response = await apiFetch<ApiEnvelope<RouteStats>>(`/api/v1/routes/${routeId}/stats`, {
    token,
    params,
  })
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}
