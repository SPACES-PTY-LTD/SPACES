import { apiFetch } from "@/lib/api/client"
import type { ApiEnvelope, Location } from "@/lib/types"

export type RunAnalysisReport = {
  conclusion: string
  expected_ending: string
  observed_ending: string
  limitations: string[]
  red_flags: { severity: "high" | "medium" | "low"; certainty: "confirmed" | "likely" | "insufficient_evidence"; title: string; finding: string; action: string; details: string; evidence_ids: string[] }[]
  missing_locations: { candidate_id: string; reason: string; suggested_name: string; location_type_id: string | null; provider_name?: string | null; provider_address?: string | null; description_source?: string; latitude?: number; longitude?: number }[]
}
export type RunAnalysis = {
  analysis_id: string; status: "queued" | "processing" | "completed" | "failed"; report: RunAnalysisReport | null
  error: string | null; created_at: string; completed_at: string | null; as_of: string | null; timezone: string
  evidence: { evidence_id: string; event: string; at: string | null; location: string | null; duration_seconds: number | null; expected_waiting_minutes: number | null }[]
}
export type RunAnalysisState = { latest: RunAnalysis | null; saved: RunAnalysis | null; stale: boolean; can_analyze: boolean; can_create_location: boolean; configured: boolean }
export function getRunAnalysis(runId: string, token: string, merchantId?: string | null, signal?: AbortSignal) {
  return apiFetch<ApiEnvelope<RunAnalysisState>>(`/api/v1/runs/${encodeURIComponent(runId)}/analysis`, { token, signal, headers: merchantId ? { "X-Merchant-Id": merchantId } : undefined, cache: "no-store" })
}
export function analyzeRun(runId: string, token: string, requestKey: string, merchantId?: string | null) {
  return apiFetch<ApiEnvelope<RunAnalysis>>(`/api/v1/runs/${encodeURIComponent(runId)}/analysis`, { token, method: "POST", body: { request_key: requestKey }, headers: merchantId ? { "X-Merchant-Id": merchantId } : undefined })
}
export function prefillAnalysisLocation(runId: string, analysisId: string, candidateId: string, token: string, merchantId?: string | null) {
  return apiFetch<ApiEnvelope<{ existing_location_id: string | null; initial_values: Partial<Location> | null }>>(`/api/v1/runs/${encodeURIComponent(runId)}/analysis/${encodeURIComponent(analysisId)}/locations/${encodeURIComponent(candidateId)}/prefill`, { token, cache: "no-store", headers: merchantId ? { "X-Merchant-Id": merchantId } : undefined })
}
