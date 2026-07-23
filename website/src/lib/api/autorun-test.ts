import { apiFetch } from "@/lib/api/client"
import type { ApiEnvelope } from "@/lib/types"

export type AutorunTestLocation = {
  location_id: string
  name?: string | null
  code?: string | null
}

export type AutorunTestResult = {
  status: "processed"
  processed_at: string
  inside_geofence: boolean
  simulated_coordinates: { latitude: number; longitude: number }
  requested_location: AutorunTestLocation
  resolved_location: AutorunTestLocation | null
  location_mismatch: boolean
}

export function runAutorunTest(
  payload: { merchant_id: string; vehicle_id: string; location_id: string },
  token?: string | null
) {
  return apiFetch<ApiEnvelope<AutorunTestResult>>("/api/v1/admin/tools/autorun-test", {
    method: "POST",
    body: payload,
    token,
  })
}
