import { runSpeedingCount } from "@/lib/run-speeding-count"
import { apiFetch } from "@/lib/api/client"
import { isApiErrorResponse } from "@/lib/api/client"
import type { ApiEnvelope, ApiListResponse, Run } from "@/lib/types"

export async function listRuns(
  token?: string | null,
  params?: {
    merchant_id?: string
    page?: number
    per_page?: number
    sort_by?: string
    sort_dir?: "asc" | "desc"
    search?: string
    status?: string
    from?: string
    to?: string
    active_only?: boolean
    with_shipments?: boolean
    summary?: boolean
  }
) {
  const response = await apiFetch<ApiListResponse<Run>>("/api/v1/runs", { token, params })
  if (isApiErrorResponse(response) || !params?.summary || !response.data.some(run => runSpeedingCount(run) === null)) {
    return response
  }

  // Older API summaries omit the count even though full run safety records exist.
  // Fetch the same page once for compatibility; current APIs keep the lightweight path.
  const details = await apiFetch<ApiListResponse<Run>>("/api/v1/runs", {
    token, params: { ...params, summary: false },
  })
  if (isApiErrorResponse(details)) return response
  const counts = new Map(details.data.map(run => [run.run_id, runSpeedingCount(run)]))
  return {
    ...response,
    data: response.data.map(run => {
      const count = runSpeedingCount(run) ?? counts.get(run.run_id)
      return count == null ? run : { ...run, speeding_alert_count: count }
    }),
  }
}

export async function getRun(runId: string, token?: string | null) {
  const response = await apiFetch<ApiEnvelope<Run>>(`/api/v1/runs/${runId}`, { token })
  if (isApiErrorResponse(response)) return response
  return response.data
}

export type RunTrack = {
  status: "ready" | "empty" | "disabled"
  source: "recorded_gps" | "limited_history"
  active: boolean
  segments: { latitude: number; longitude: number; observed_at: string }[][]
  stops: { latitude: number; longitude: number; first_seen_at: string; last_seen_at: string; sample_count: number }[]
  updated_at: string | null
  latest_observed_at: string | null
  coverage: { partial: boolean; next_before: string | null; displayed_coordinates: number; from?: string; to?: string; gap_count?: number }
}

export async function getRunTrack(runId: string, token?: string | null, before?: string) {
  const response = await apiFetch<ApiEnvelope<RunTrack>>(`/api/v1/runs/${runId}/track`, { token, params: { before } })
  return isApiErrorResponse(response) ? response : response.data
}
