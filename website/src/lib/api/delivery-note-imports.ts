import { apiFetch } from "@/lib/api/client"
import type {
  ApiEnvelope,
  DeliveryNoteExtraction,
  DeliveryNoteImport,
  Run,
} from "@/lib/types"

export type DeliveryNoteConfirmPayload = Omit<DeliveryNoteExtraction, "pickup_address" | "dropoff_address"> & {
  grouping_mode: "separate_shipments" | "single_shipment"
  pickup_address?: DeliveryNoteExtraction["pickup_address"]
  dropoff_address?: DeliveryNoteExtraction["dropoff_address"]
}

export async function analyzeDeliveryNote(
  runId: string,
  file: File,
  token?: string | null
) {
  const body = new FormData()
  body.append("file", file)
  return apiFetch<ApiEnvelope<DeliveryNoteImport>>(
    `/api/v1/runs/${runId}/delivery-note-imports`,
    { method: "POST", body, token }
  )
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
