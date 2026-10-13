import type { DeliveryNoteExtraction, DeliveryNoteLineItem, Location } from "@/lib/types"

export const quantityUnits = ["bags", "boxes", "crates", "cubic_metres", "drums", "kilograms", "liters", "pallets", "rolls", "tonnes", "units"] as const
export type ImportRow = Omit<DeliveryNoteLineItem, "quantity"> & {
  quantity: number | string
  quantity_unit: string
  collection_date: string
  pickup_location_id?: string | null
  dropoff_location_id?: string | null
  pickup?: Location | null
  dropoff?: Location | null
  pickup_instructions?: string | null
  dropoff_instructions?: string | null
  excluded?: boolean
}
export type RunDraft = {
  importId: string; filename: string; step: number; analyzed: boolean
  extraction?: DeliveryNoteExtraction
  origin?: Location | null; destination?: Location | null
  delivery_note_number: string; rows: ImportRow[]
  driver_id: string; vehicle_id: string; planned_start_at: string; service_area: string; notes: string
  shipment_ids: string[]
}
export type ImportReview = {
  rows: { index: number; reference: string; eligibility: "new" | "existing" | "excluded"; validation_warnings: string[]; collection_comparison: string }[]
  warnings: string[]; can_confirm: boolean
}
export const emptyRunDraft = (): RunDraft => ({ importId: "", filename: "", step: 1, analyzed: false, delivery_note_number: "", rows: [], driver_id: "", vehicle_id: "", planned_start_at: "", service_area: "", notes: "", shipment_ids: [] })
export function extractedRows(data: DeliveryNoteExtraction): ImportRow[] {
  return (data.line_items?.length ? data.line_items : [{}]).map(row => ({
    ...row, quantity: row.quantity ?? 1, quantity_unit: "units", collection_date: data.collection_date?.slice(0, 10) ?? "",
    pickup_instructions: data.pickup_instructions, dropoff_instructions: data.dropoff_instructions,
  }))
}
export function hasMapPosition(location?: Location | null) {
  return !!location && location.latitude !== null && location.latitude !== undefined && location.longitude !== null && location.longitude !== undefined && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))
}
export function eligibleManualShipment(shipment: { status: string; run_id?: string | null; run_status?: string | null; run_shipment_status?: string | null }) {
  return !["delivered", "failed", "cancelled", "returned"].includes(shipment.status) && !(shipment.run_id && shipment.run_shipment_status !== "removed" && ["draft", "dispatched", "in_progress"].includes(shipment.run_status ?? ""))
}
export function validateDocumentFile(file: { size: number; type: string; name: string }) {
  if (file.size > 20 * 1024 * 1024) return "Choose a document smaller than 20 MB."
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type) || !/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) return "Choose a PDF, JPG, PNG or WebP document."
  return ""
}
