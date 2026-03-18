import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type { ApiEnvelope } from "@/lib/types"

export const purgeDataTypes = [
  "shipments",
  "runs",
  "vehicle_activity",
  "routes",
  "drivers",
  "vehicles",
  "locations",
  "location_types",
  "api_call_logs",
  "idempotency_keys",
  "activity_logs",
] as const

export type PurgeDataType = (typeof purgeDataTypes)[number]

export type PurgeDataPayload = {
  merchant_id: string
  password: string
  types: PurgeDataType[]
}

export type PurgeDataTypeResult = {
  deleted_rows?: number
  tables?: Record<string, number>
}

export type PurgeDataResponse = {
  merchant_uuid: string
  requested_types: string[]
  processed_types: string[]
  results: Record<string, PurgeDataTypeResult>
}

export async function purgeMerchantData(
  merchantUuid: string,
  payload: PurgeDataPayload,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<PurgeDataResponse>>(
    `/api/v1/merchants/${merchantUuid}/purge-data`,
    {
      method: "POST",
      body: payload,
      token,
    }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response
}
