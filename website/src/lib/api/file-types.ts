import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type { ApiEnvelope, ApiListResponse, FileType } from "@/lib/types"

export async function listFileTypes(
  token?: string | null,
  params?: {
    merchant_id?: string
    entity_type?: "shipment" | "driver" | "vehicle"
    is_active?: boolean
    per_page?: number
  }
) {
  return apiFetch<ApiListResponse<FileType>>("/api/v1/file-types", {
    token,
    params,
  })
}

export async function createFileType(
  payload: {
    merchant_id: string
    entity_type: "shipment" | "driver" | "vehicle"
    name: string
    slug?: string
    description?: string
    requires_expiry?: boolean
    driver_can_upload?: boolean
    is_active?: boolean
    sort_order?: number
  },
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<FileType>>("/api/v1/file-types", {
    method: "POST",
    body: payload,
    token,
  })

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function updateFileType(
  fileTypeId: string,
  payload: Partial<{
    entity_type: "shipment" | "driver" | "vehicle"
    name: string
    slug: string
    description: string
    requires_expiry: boolean
    driver_can_upload: boolean
    is_active: boolean
    sort_order: number
  }>,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<FileType>>(
    `/api/v1/file-types/${fileTypeId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}
