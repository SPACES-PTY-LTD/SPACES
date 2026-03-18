import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type { ApiEnvelope, ApiListResponse, VehicleType } from "@/lib/types"

export async function listVehicleTypes(
  token?: string | null,
  params?: { page?: number }
) {
  return apiFetch<ApiListResponse<VehicleType>>(
    "/api/v1/vehicle-types",
    { token, params }
  )
}

export async function getVehicleType(
  vehicleTypeId: string,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<VehicleType>>(
    `/api/v1/vehicle-types/${vehicleTypeId}`,
    { token }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function createVehicleType(
  payload: Partial<VehicleType>,
  token?: string | null
) {
  return apiFetch<VehicleType>("/api/v1/vehicle-types", {
    method: "POST",
    body: payload,
    token,
  })
}

export async function updateVehicleType(
  vehicleTypeId: string,
  payload: Partial<VehicleType>,
  token?: string | null
) {
  return apiFetch<VehicleType>(
    `/api/v1/vehicle-types/${vehicleTypeId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    }
  )
}

export async function deleteVehicleType(
  vehicleTypeId: string,
  token?: string | null
) {
  return apiFetch<void>(
    `/api/v1/vehicle-types/${vehicleTypeId}`,
    { method: "DELETE", token }
  )
}
