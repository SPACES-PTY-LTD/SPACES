import { apiFetch } from "@/lib/api/client"
import type { ApiListResponse, DriverVehicle, VehicleType } from "@/lib/types"

export type DriverVehiclePayload = {
  vehicle_type_id: string
  make: string
  model: string
  color: string
  plate_number: string
  photo_key: string
}

export type AssignDriverVehiclePayload = {
  vehicle_id: string
}

export async function assignDriverVehicle(
  driverId: string,
  payload: AssignDriverVehiclePayload,
  token?: string | null
) {
  return apiFetch<void>(
    `/api/v1/drivers/${driverId}/vehicles`,
    {
      method: "POST",
      body: payload,
      token,
    }
  )
}

export async function listDriverVehicles(
  driverId: string,
  token?: string | null
) {
  return apiFetch<ApiListResponse<DriverVehicle>>(
    `/api/v1/drivers/${driverId}/vehicles`,
    { token }
  )
}

export async function updateDriverVehicle(
  vehicleId: string,
  payload: DriverVehiclePayload,
  token?: string | null
) {
  return apiFetch<VehicleType>(
    `/api/v1/admin/driver-vehicles/${vehicleId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    }
  )
}

export async function deleteDriverVehicle(
  vehicleId: string,
  token?: string | null
) {
  return apiFetch<void>(`/api/v1/admin/driver-vehicles/${vehicleId}`, {
    method: "DELETE",
    token,
  })
}
