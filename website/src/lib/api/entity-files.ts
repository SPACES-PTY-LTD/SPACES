import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type { ApiEnvelope, ApiListResponse, EntityFile } from "@/lib/types"

function buildUploadPayload(payload: {
  merchant_id?: string
  file_type_id: string
  file: File
  expires_at?: string
}) {
  const formData = new FormData()
  if (payload.merchant_id) {
    formData.set("merchant_id", payload.merchant_id)
  }
  formData.set("file_type_id", payload.file_type_id)
  formData.set("file", payload.file)
  if (payload.expires_at) {
    formData.set("expires_at", payload.expires_at)
  }
  return formData
}

export async function listShipmentFiles(shipmentId: string, token?: string | null) {
  return apiFetch<ApiListResponse<EntityFile>>(`/api/v1/shipments/${shipmentId}/files`, {
    token,
  })
}

export async function listExpiredEntityFiles(
  token?: string | null,
  params?: { merchant_id?: string; per_page?: number }
) {
  return apiFetch<ApiListResponse<EntityFile>>("/api/v1/files/expired", {
    token,
    params,
  })
}

export async function uploadShipmentFile(
  shipmentId: string,
  payload: {
    merchant_id?: string
    file_type_id: string
    file: File
    expires_at?: string
  },
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<EntityFile>>(
    `/api/v1/shipments/${shipmentId}/files`,
    {
      method: "POST",
      body: buildUploadPayload(payload),
      token,
    }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function listDriverFiles(driverId: string, token?: string | null) {
  return apiFetch<ApiListResponse<EntityFile>>(`/api/v1/drivers/${driverId}/files`, {
    token,
  })
}

export async function uploadDriverFile(
  driverId: string,
  payload: {
    merchant_id?: string
    file_type_id: string
    file: File
    expires_at?: string
  },
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<EntityFile>>(
    `/api/v1/drivers/${driverId}/files`,
    {
      method: "POST",
      body: buildUploadPayload(payload),
      token,
    }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function listVehicleFiles(
  vehicleId: string,
  token?: string | null,
  params?: { merchant_id?: string }
) {
  return apiFetch<ApiListResponse<EntityFile>>(`/api/v1/vehicles/${vehicleId}/files`, {
    token,
    params,
  })
}

export async function uploadVehicleFile(
  vehicleId: string,
  payload: {
    merchant_id?: string
    file_type_id: string
    file: File
    expires_at?: string
  },
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<EntityFile>>(
    `/api/v1/vehicles/${vehicleId}/files`,
    {
      method: "POST",
      body: buildUploadPayload(payload),
      token,
      params: {
        merchant_id: payload.merchant_id,
      },
    }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function deleteEntityFile(fileId: string, token?: string | null) {
  return apiFetch<void>(`/api/v1/files/${fileId}`, {
    method: "DELETE",
    token,
  })
}

export async function getEntityFileDownloadUrl(fileId: string, token?: string | null) {
  const response = await apiFetch<ApiEnvelope<{ url: string }>>(
    `/api/v1/files/${fileId}/download`,
    {
      token,
      params: { format: "url" },
    }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data.url
}
