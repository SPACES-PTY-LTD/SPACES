import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type { ImportCsvResult } from "@/lib/api/imports"
import type { ApiEnvelope, ApiListResponse, DriverVehicle, Vehicle } from "@/lib/types"

export type VehiclePayload = {
  merchant_id: string
  vehicle_type_id: string
  make: string
  model: string
  color: string
  plate_number: string
  photo_key?: string | null
  vin_number?: string | null
  engine_number?: string | null
  ref_code?: string | null
  last_location_address?: string | null
  location_updated_at?: string | null
  intergration_id?: string | null
  is_active?: boolean
}

export type VehicleMaintenancePayload = {
  maintenance_mode: boolean
  maintenance_expected_resolved_at?: string | null
  maintenance_description?: string | null
}

export async function listVehicles(
    token?: string | null,
    { per_page, page, search, with_location_only, merchant_id, tag_id, sort_by, sort_dir }:
    {
      per_page?: number
      page?: number
      search?: string
      with_location_only?: boolean
      merchant_id?: string
      tag_id?: string
      sort_by?: string
      sort_dir?: "asc" | "desc"
    } = {}) {
  return apiFetch<ApiListResponse<DriverVehicle>>("/api/v1/vehicles", {
    token,
    params: {
      per_page: per_page ?? 20,
      page: page ?? 1,
      search,
      merchant_id,
      tag_id,
      sort_by,
      sort_dir,
      with_location_only: with_location_only ? "true" : undefined,
    },
  })
}

export async function getVehicle(
  vehicleId: string,
  token?: string | null,
  params?: { merchant_id?: string }
) {
  const response = await apiFetch<ApiEnvelope<Vehicle>>(
    `/api/v1/vehicles/${vehicleId}`,
    { token, params }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function createVehicle(
  payload: VehiclePayload,
  token?: string | null
) {
  return apiFetch<Vehicle>("/api/v1/vehicles", {
    method: "POST",
    body: payload,
    token,
  })
}

export async function updateVehicle(
  vehicleId: string,
  payload: Partial<VehiclePayload>,
  token?: string | null
) {
  return apiFetch<Vehicle>(
    `/api/v1/vehicles/${vehicleId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    }
  )
}

export async function updateVehicleMaintenance(
  vehicleId: string,
  payload: VehicleMaintenancePayload,
  token?: string | null
) {
  return apiFetch<Vehicle>(`/api/v1/vehicles/${vehicleId}/maintenance`, {
    method: "PATCH",
    body: payload,
    token,
  })
}

export async function deleteVehicle(
  vehicleId: string,
  token?: string | null
) {
  return apiFetch<void>(`/api/v1/vehicles/${vehicleId}`, {
    method: "DELETE",
    token,
  })
}

export async function importVehiclesCsv(
  payload: { merchant_id: string; file: File },
  token?: string | null
) {
  const formData = new FormData()
  formData.set("merchant_id", payload.merchant_id)
  formData.set("file", payload.file)

  return apiFetch<ApiEnvelope<ImportCsvResult>>("/api/v1/vehicles/import", {
    method: "POST",
    body: formData,
    token,
  })
}
