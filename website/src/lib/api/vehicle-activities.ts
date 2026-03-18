import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type { ApiEnvelope, ApiListResponse, VehicleActivity } from "@/lib/types"

export type ListVehicleActivitiesParams = {
  page?: number
  per_page?: number
  merchant_id?: string
  vehicle_id?: string
  location_id?: string
  plate_number?: string
  event_type?: string
  from?: string
  to?: string
}

export type VehicleActivitiesResponse = ApiEnvelope<VehicleActivity[]> & ApiListResponse<VehicleActivity>

export async function listVehicleActivities(
  token?: string | null,
  params: ListVehicleActivitiesParams = {}
) {
  return apiFetch<VehicleActivitiesResponse>("/api/v1/vehicle-activities", {
    token,
    params: {
      page: params.page,
      per_page: params.per_page,
      merchant_id: params.merchant_id,
      vehicle_id: params.vehicle_id,
      location_id: params.location_id,
      plate_number: params.plate_number,
      event_type: params.event_type,
      from: params.from,
      to: params.to,
    },
  })
}

export async function listAllVehiclesCheck(
  token?: string | null,
  params: Pick<ListVehicleActivitiesParams, "page" | "per_page" | "merchant_id" | "plate_number"> = {}
) {
  return apiFetch<VehicleActivitiesResponse>("/api/v1/vehicles/latest-activity-check", {
    token,
    params: {
      page: params.page,
      per_page: params.per_page,
      merchant_id: params.merchant_id,
      plate_number: params.plate_number,
    },
  })
}

export async function getVehicleActivity(activityId: string, token?: string | null) {
  const response = await apiFetch<ApiEnvelope<VehicleActivity>>(
    `/api/v1/vehicle-activities/${activityId}`,
    { token }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}
