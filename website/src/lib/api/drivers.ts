import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type {
  ApiEnvelope,
  ApiListResponse,
  CreateDriverPayload,
  Driver,
} from "@/lib/types"
import type { ImportCsvResult } from "@/lib/api/imports"

export async function listDrivers(
  token?: string | null,
  params?: {
    merchant_id?: string
    page?: number
    per_page?: number
    search?: string
    sort_by?: string
    sort_dir?: "asc" | "desc"
  }
) {
  return apiFetch<ApiListResponse<Driver>>("/api/v1/drivers", { token, params })
}

export async function getDriver(
  driverId: string,
  token?: string | null,
  params?: { merchant_id?: string }
) {
  const response = await apiFetch<ApiEnvelope<Driver>>(
    `/api/v1/drivers/${driverId}`,
    { token, params }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function createDriver(
  payload: CreateDriverPayload,
  token?: string | null
) {
  return apiFetch<Driver>("/api/v1/drivers", {
    method: "POST",
    body: payload,
    token,
  })
}

export async function updateDriver(
  driverId: string,
  payload: Partial<Driver>,
  token?: string | null
) {
  return apiFetch<Driver>(`/api/v1/drivers/${driverId}`, {
    method: "PATCH",
    body: payload,
    token,
  })
}

export async function deleteDriver(driverId: string, token?: string | null) {
  return apiFetch<void>(`/api/v1/drivers/${driverId}`, {
    method: "DELETE",
    token,
  })
}

export async function importDriversCsv(
  payload: { merchant_id: string; file: File },
  token?: string | null
) {
  const formData = new FormData()
  formData.set("merchant_id", payload.merchant_id)
  formData.set("file", payload.file)

  return apiFetch<ApiEnvelope<ImportCsvResult>>("/api/v1/drivers/import", {
    method: "POST",
    body: formData,
    token,
  })
}
