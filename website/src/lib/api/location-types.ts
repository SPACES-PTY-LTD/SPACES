import { apiFetch } from "@/lib/api/client"
import type { ApiEnvelope, LocationType } from "@/lib/types"

export type ListLocationTypesParams = {
  merchant_id: string
  collection_point?: boolean
  default?: boolean
}

export type LocationTypesMeta = {
  request_id?: string
  is_default_fallback?: boolean
}

export type ListLocationTypesResponse = ApiEnvelope<LocationType[]> & {
  meta?: LocationTypesMeta
}

export type UpsertLocationTypePayload = {
  location_type_id?: string
  slug?: string | null
  title: string
  collection_point: boolean
  delivery_point: boolean
  sequence: number
  icon?: string | null
  color?: string | null
  default: boolean
}

export type PatchLocationTypesPayload = {
  merchant_id: string
  types: UpsertLocationTypePayload[]
}

export async function listLocationTypes(
  token?: string | null,
  params?: ListLocationTypesParams
) {
  return apiFetch<ListLocationTypesResponse>("/api/v1/location-types", {
    token,
    params,
  })
}

export async function patchLocationTypes(
  payload: PatchLocationTypesPayload,
  token?: string | null
) {
  return apiFetch<ApiEnvelope<LocationType[]>>("/api/v1/location-types", {
    method: "PATCH",
    body: payload,
    token,
  })
}

export async function patchLocationType(
  locationTypeId: string,
  payload: Partial<UpsertLocationTypePayload>,
  token?: string | null
) {
  return apiFetch<ApiEnvelope<LocationType>>(
    `/api/v1/location-types/${locationTypeId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    }
  )
}
