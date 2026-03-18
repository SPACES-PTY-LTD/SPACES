import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type {
  ApiEnvelope,
  ApiListResponse,
  CreateShipmentPayload,
  Quote,
  Shipment,
} from "@/lib/types"

export type AssignShipmentDriverPayload = {
  driver_id: string
  vehicle_id?: string | null
  planned_start_at?: string
  notes?: string | null
}

export type AssignShipmentVehiclePayload = {
  vehicle_id: string
  collection_date?: string
}

export async function listShipments(
  token?: string | null,
  params?: {
    page?: number
    per_page?: number
    merchant_order_ref?: string
    search?: string
    merchant_id?: string
    status?: string
    service_type?: string
    priority?: string
    auto_assign?: boolean
    invoiced?: boolean
    from?: string
    to?: string
    sort_by?: string
    sort_dir?: "asc" | "desc"
  }
) {
  return apiFetch<ApiListResponse<Shipment>>("/api/v1/shipments", {
    token,
    params,
  })
}

export async function listShipmentQuotes(
  shipmentId: string,
  token?: string | null,
  params?: { merchant_id?: string }
) {
  return apiFetch<ApiListResponse<Quote>>(
    `/api/v1/shipments/${shipmentId}/quotes`,
    { token, params }
  )
}

export async function getShipment(
  shipmentId: string,
  token?: string | null,
  params?: { merchant_id?: string }
) {
  const response = await apiFetch<ApiEnvelope<Shipment>>(
    `/api/v1/shipments/${shipmentId}`,
    { token, params }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function createShipment(
  payload: CreateShipmentPayload,
  token?: string | null
) {
  return apiFetch<Shipment>("/api/v1/shipments", {
    method: "POST",
    body: payload,
    token,
  })
}

export async function updateShipment(
  shipmentId: string,
  payload: Partial<Shipment>,
  token?: string | null
) {
  return apiFetch<Shipment>(`/api/v1/shipments/${shipmentId}`, {
    method: "PATCH",
    body: payload,
    token,
  })
}

export async function assignShipmentDriver(
  shipmentId: string,
  payload: AssignShipmentDriverPayload,
  token?: string | null
) {
  return apiFetch<Shipment>(`/api/v1/shipments/${shipmentId}/assign_driver`, {
    method: "POST",
    body: payload,
    token,
  })
}

export async function assignShipmentVehicle(
  shipmentId: string,
  payload: AssignShipmentVehiclePayload,
  token?: string | null
) {
  return apiFetch<void>(`/api/v1/shipments/${shipmentId}/assign_vehicle`, {
    method: "POST",
    body: payload,
    token,
  })
}

export async function deleteShipment(shipmentId: string, token?: string | null) {
  return apiFetch<void>(`/api/v1/shipments/${shipmentId}`, {
    method: "DELETE",
    token,
  })
}

export async function getShipmentLabel(
  shipmentId: string,
  token?: string | null
) {
  return apiFetch<Blob>(`/api/v1/shipments/${shipmentId}/label`, {
    method: "GET",
    token,
  })
}

export async function getShipmentTracking(
  shipmentId: string,
  token?: string | null
) {
  return apiFetch<Record<string, string | number>>(
    `/api/v1/shipments/${shipmentId}/tracking`,
    { token }
  )
}

export async function bookShipment(
  shipmentId: string,
  optionId: string,
  token?: string | null
) {
  return apiFetch<void>(`/api/v1/shipments/${shipmentId}/book`, {
    method: "POST",
    body: { quote_option_id: optionId },
    token,
  })
}
