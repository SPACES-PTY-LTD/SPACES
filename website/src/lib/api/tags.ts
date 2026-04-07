import { apiFetch } from "@/lib/api/client"
import type { ApiEnvelope, ApiListResponse, Location, Tag, Vehicle } from "@/lib/types"

export async function listTags(
  token?: string | null,
  params?: {
    merchant_id?: string
    search?: string
    per_page?: number
  }
) {
  return apiFetch<ApiListResponse<Tag>>("/api/v1/tags", {
    token,
    params,
  })
}

export async function updateVehicleTags(
  vehicleId: string,
  tags: string[],
  token?: string | null
) {
  return apiFetch<ApiEnvelope<Vehicle>>(`/api/v1/vehicles/${vehicleId}/tags`, {
    method: "PATCH",
    body: { tags },
    token,
  })
}

export async function updateLocationTags(
  locationId: string,
  tags: string[],
  token?: string | null
) {
  return apiFetch<ApiEnvelope<Location>>(`/api/v1/locations/${locationId}/tags`, {
    method: "PATCH",
    body: { tags },
    token,
  })
}
