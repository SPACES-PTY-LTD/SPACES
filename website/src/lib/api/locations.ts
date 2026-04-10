import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type { ApiEnvelope, ApiListResponse, Location } from "@/lib/types"

export type LocationPayload = {
  merchant_id?: string
  environment_id?: string
  location_type_id?: string | null
  name: string
  code?: string | null
  company?: string | null
  full_address?: string | null
  address_line_1?: string | null
  address_line_2?: string | null
  town?: string | null
  city?: string | null
  country?: string | null
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  province?: string | null
  post_code?: string | null
  latitude?: number | null
  longitude?: number | null
  google_place_id?: string | null
  polygon_bounds?: number[][] | null
}

export type ImportLocationsResult = {
  processed: number
  created: number
  updated: number
  failed: number
  errors?: Array<{
    line: number
    errors: string[]
  }>
}

export async function listLocations(
  token?: string | null,
  params?: {
    merchant_id?: string
    page?: number
    per_page?: number
    search?: string
    location_type_id?: string
    tag_id?: string
    geofence_status?: "all" | "with" | "without"
    sort_by?: string
    sort_dir?: "asc" | "desc"
  }
) {
  return apiFetch<ApiListResponse<Location>>("/api/v1/locations", {
    token,
    params,
  })
}

export async function getLocation(
  locationId: string,
  token?: string | null,
  params?: { merchant_id?: string }
) {
  const response = await apiFetch<ApiEnvelope<Location>>(
    `/api/v1/locations/${locationId}`,
    { token, params }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function createLocation(
  payload: LocationPayload,
  token?: string | null
) {
  return apiFetch<Location>("/api/v1/locations", {
    method: "POST",
    body: payload,
    token,
  })
}

export async function updateLocation(
  locationId: string,
  payload: Partial<LocationPayload>,
  token?: string | null
) {
  return apiFetch<Location>(`/api/v1/locations/${locationId}`, {
    method: "PATCH",
    body: payload,
    token,
  })
}

export async function deleteLocation(locationId: string, token?: string | null) {
  return apiFetch<void>(`/api/v1/locations/${locationId}`, {
    method: "DELETE",
    token,
  })
}

export async function importLocationsCsv(
  payload: { merchant_id: string; file: File },
  token?: string | null
) {
  const formData = new FormData()
  formData.set("merchant_id", payload.merchant_id)
  formData.set("file", payload.file)

  return apiFetch<ApiEnvelope<ImportLocationsResult>>("/api/v1/locations/import", {
    method: "POST",
    body: formData,
    token,
  })
}
