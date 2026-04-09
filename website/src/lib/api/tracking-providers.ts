import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type {
  ApiEnvelope,
  ApiListResponse,
  MixTokenAnalysis,
  TrackingProvider,
  TrackingProviderVehiclePreview,
} from "@/lib/types"

export type ImportEntityKey = "locations" | "drivers" | "vehicles"

export type TrackingProviderImportStats = {
  inprogress: Record<ImportEntityKey, string | null>
  last_import_counts: Record<ImportEntityKey, number>
  last_import_errors: Record<ImportEntityKey, string | null>
}

export type QueuedImportResponse = {
  queued: boolean
  already_in_progress: boolean
  imports_stats: TrackingProviderImportStats
}

export async function listTrackingProviders(
  token?: string | null,
  merchantId?: string | null
) {
  return apiFetch<ApiListResponse<TrackingProvider>>("/api/v1/tracking-providers", {
    token,
    params: merchantId ? { merchant_id: merchantId } : undefined,
  })
}

export async function getTrackingProvider(
  providerId: string,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<TrackingProvider>>(
    `/api/v1/tracking-providers/${providerId}`,
    { token }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function activateTrackingProvider(
  providerId: string,
  merchantId: string,
  integrationData: Record<string, unknown>,
  token?: string | null
) {
  const response = apiFetch<void>("/api/v1/tracking-providers/activate", {
    method: "POST",
    body: {
      provider_id: providerId,
      merchant_id: merchantId,
      integration_data: integrationData,
    },
    token,
  })

  return response
}

export async function importTrackingProviderVehicles(
  providerId: string,
  merchantId: string,
  vehicles: Array<{ provider_vehicle_id: string; vehicle_type_id: string }>,
  token?: string | null
) {
  return apiFetch<QueuedImportResponse>(
    `/api/v1/tracking-providers/${providerId}/import_vehicles`,
    {
      method: "POST",
      body: {
        merchant_id: merchantId,
        vehicles,
      },
      token,
    }
  )
}

export async function listTrackingProviderVehicles(
  providerId: string,
  merchantId: string,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<TrackingProviderVehiclePreview[]>>(
    `/api/v1/tracking-providers/${providerId}/vehicles`,
    {
      token,
      params: { merchant_id: merchantId },
    }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function importTrackingProviderDrivers(
  providerId: string,
  merchantId: string,
  options?: {
    filter_type?: "name" | "fmdriverid" | "employeenumber"
    wildcard?: string
  },
  token?: string | null
) {
  const payload: Record<string, unknown> = { merchant_id: merchantId }
  if (options?.filter_type) payload.filter_type = options.filter_type
  if (options?.wildcard) payload.wildcard = options.wildcard

  return apiFetch<QueuedImportResponse>(
    `/api/v1/tracking-providers/${providerId}/import_drivers`,
    {
      method: "POST",
      body: payload,
      token,
    }
  )
}

export async function importTrackingProviderLocations(
  providerId: string,
  merchantId: string,
  options?: {
    only_with_geofences?: boolean
  },
  token?: string | null
) {
  return apiFetch<QueuedImportResponse>(
    `/api/v1/tracking-providers/${providerId}/import_locations`,
    {
      method: "POST",
      body: {
        merchant_id: merchantId,
        ...(options?.only_with_geofences ? { only_with_geofences: true } : {}),
      },
      token,
    }
  )
}

export async function getTrackingProviderImportsStatuses(
  merchantId: string,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<TrackingProviderImportStats>>(
    "/api/v1/tracking-providers/imports-statuses",
    {
      token,
      params: { merchant_id: merchantId },
    }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}

export async function inspectTrackingProviderMixToken(
  providerId: string,
  merchantId: string,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<MixTokenAnalysis>>(
    `/api/v1/tracking-providers/${providerId}/mix-token-analysis`,
    {
      method: "POST",
      body: {
        merchant_id: merchantId,
      },
      token,
    }
  )

  if (isApiErrorResponse(response)) {
    return response
  }

  return response.data
}
