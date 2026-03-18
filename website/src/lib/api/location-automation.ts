import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type {
  ApiEnvelope,
  LocationAutomationRule,
} from "@/lib/types"

export type MerchantLocationAutomation = {
  merchant_id: string
  enabled: boolean
  location_types: LocationAutomationRule[]
}

export type UpdateMerchantLocationAutomationPayload = {
  enabled?: boolean
  location_types?: Array<{
    location_type_id: string
    entry: Array<{
      id: string
      action: string
      conditions: Array<{
        id: string
        field: string
        operator: string
        value: string
      }>
    }>
    exit: Array<{
      id: string
      action: string
      conditions: Array<{
        id: string
        field: string
        operator: string
        value: string
      }>
    }>
  }>
}

export async function getMerchantLocationAutomation(
  merchantId: string,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<MerchantLocationAutomation>>(
    `/api/v1/merchants/${merchantId}/location-automation`,
    { token }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function updateMerchantLocationAutomation(
  merchantId: string,
  payload: UpdateMerchantLocationAutomationPayload,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<MerchantLocationAutomation>>(
    `/api/v1/merchants/${merchantId}/location-automation`,
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
