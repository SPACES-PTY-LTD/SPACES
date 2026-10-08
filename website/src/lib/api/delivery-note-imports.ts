import { apiFetch } from "@/lib/api/client"
import type {
  ApiEnvelope,
  DeliveryNoteExtraction,
  Run,
} from "@/lib/types"

export type DeliveryNoteConfirmPayload = Omit<DeliveryNoteExtraction, "pickup_address" | "dropoff_address"> & {
  grouping_mode: "separate_shipments" | "single_shipment"
  pickup_address?: DeliveryNoteExtraction["pickup_address"]
  dropoff_address?: DeliveryNoteExtraction["dropoff_address"]
}

export type DeliveryNoteAnalysis = {
  import_id: string
  status: "queued" | "processing" | "analyzed" | "confirmed" | "failed"
  failure_message?: string | null
  extracted_data?: DeliveryNoteExtraction
}

export async function analyzeDeliveryNote(
  runId: string, file: File, token: string | null | undefined,
  context: { importId: string; merchantId: string; environmentId?: string | null; signal?: AbortSignal }
) {
  const body = new FormData()
  body.append("file", file)
  body.append("run_id", runId)
  body.append("import_id", context.importId)
  body.append("merchant_id", context.merchantId)
  if (context.environmentId) body.append("environment_id", context.environmentId)
  return apiFetch<ApiEnvelope<DeliveryNoteAnalysis>>(
    "/api/v1/delivery-note-imports/analyze", { method: "POST", body, token, signal: context.signal }
  )
}

export function getDeliveryNoteAnalysis(importId: string, merchantId: string, token: string, signal: AbortSignal, environmentId?: string | null) {
  return apiFetch<ApiEnvelope<DeliveryNoteAnalysis>>(`/api/v1/delivery-note-imports/${importId}/status`, {
    token, signal, params: { merchant_id: merchantId, environment_id: environmentId ?? undefined },
  })
}

export async function confirmDeliveryNoteImport(
  runId: string,
  importId: string,
  payload: DeliveryNoteConfirmPayload,
  token?: string | null
) {
  return apiFetch<
    ApiEnvelope<{
      run: Run
      shipment_ids: string[]
      already_confirmed: boolean
    }>
  >(`/api/v1/runs/${runId}/delivery-note-imports/${importId}/confirm`, {
    method: "POST",
    body: payload,
    token,
  })
}

export async function downloadDeliveryNoteImport(
  runId: string,
  importId: string,
  token?: string | null
) {
  return apiFetch<Blob>(
    `/api/v1/runs/${runId}/delivery-note-imports/${importId}/download`,
    { token }
  )
}
