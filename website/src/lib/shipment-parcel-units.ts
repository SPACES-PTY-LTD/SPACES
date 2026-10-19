import type { ShipmentParcelInput } from "@/lib/types"

export const parcelUnits = ["bags", "boxes", "crates", "cubic_metres", "drums", "kilograms", "liters", "pallets", "rolls", "tonnes", "units"] as const
export const unitLabel = (unit: string) => unit.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase())
export const measuredUnit = (unit: string) => ["kilograms", "tonnes", "liters", "cubic_metres"].includes(unit)
export const parcelMeasurements = (unit = "units") => ({
  weight: ["bags", "boxes", "crates", "cubic_metres", "drums", "liters", "pallets", "rolls"].includes(unit),
  dimensions: ["boxes", "crates", "pallets"].includes(unit),
})
export function parcelQuantityError(lines: ShipmentParcelInput[]): string | null {
  let count = 0
  for (const line of lines) {
    const unit = line.quantity_unit ?? "units"
    const quantity = Number(line.quantity ?? 1)
    if (!(parcelUnits as readonly string[]).includes(unit)) return "Choose a valid unit type."
    const max = unit === "tonnes" ? 9999.999 : measuredUnit(unit) ? 1000000 : 100
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > max || (!measuredUnit(unit) && !Number.isInteger(quantity))) {
      return `${unitLabel(unit)} quantity must be ${measuredUnit(unit) ? "a positive number" : "a whole number"} up to ${max}.`
    }
    count += measuredUnit(unit) ? 1 : quantity
  }
  return count > 500 ? "A shipment can contain up to 500 parcels." : null
}
export function shipmentParcelPayload(lines: ShipmentParcelInput[]) {
  const error = parcelQuantityError(lines)
  if (error) throw new Error(error)
  return lines.flatMap(line => {
    const unit = line.quantity_unit ?? "units"
    const quantity = Number(line.quantity ?? 1)
    const positive = (value: number) => value > 0 ? value : null
    const parcel = {
      contents_description: line.title,
      weight: unit === "kilograms" ? quantity : unit === "tonnes" ? quantity * 1000 : positive(line.weight_kg),
      weight_measurement: "kg" as const,
      length_cm: positive(line.length_cm), width_cm: positive(line.width_cm), height_cm: positive(line.height_cm),
    }
    return Array.from({ length: measuredUnit(unit) ? 1 : quantity }, () => ({ ...parcel }))
  })
}
// Keep editor lines alongside expanded physical parcels, without changing the parcel schema.
export function parcelEditorMetadata(lines: ShipmentParcelInput[], existing?: Record<string, unknown> | null) {
  return { ...existing, admin_parcel_lines: lines, admin_parcel_signature: JSON.stringify(shipmentParcelPayload(lines)) }
}
export function restoreParcelLines(parcels: Array<{ contents_description?: string | null; weight?: number | string | null; weight_kg?: number | string | null; length_cm?: number | string | null; width_cm?: number | string | null; height_cm?: number | string | null }>, metadata?: Record<string, unknown> | null): ShipmentParcelInput[] {
  const fallback = parcels.map(parcel => ({ title: parcel.contents_description ?? "", quantity: 1, quantity_unit: "units", weight_kg: Number(parcel.weight_kg ?? parcel.weight ?? 0), length_cm: Number(parcel.length_cm ?? 0), width_cm: Number(parcel.width_cm ?? 0), height_cm: Number(parcel.height_cm ?? 0) }))
  const saved = metadata?.admin_parcel_lines
  if (Array.isArray(saved) && saved.every(line => line && typeof line.title === "string" && ["weight_kg", "length_cm", "width_cm", "height_cm"].every(key => typeof line[key] === "number"))) {
    try {
      if (JSON.stringify(shipmentParcelPayload(fallback)) === metadata?.admin_parcel_signature && JSON.stringify(shipmentParcelPayload(saved)) === metadata?.admin_parcel_signature) return saved
    } catch { /* Fall back to persisted parcels if stored editor metadata is stale or invalid. */ }
  }
  // Mobile imports already store source quantities; group only when they reproduce the persisted parcels exactly.
  const imported = metadata?.delivery_note_items
  if (!saved && Array.isArray(imported)) {
    let offset = 0
    const lines: ShipmentParcelInput[] = []
    for (const item of imported) {
      if (!item || typeof item !== "object") break
      const unit = typeof item.quantity_unit === "string" ? item.quantity_unit : "units"
      const quantity = Number(item.quantity ?? 1)
      const count = measuredUnit(unit) ? 1 : quantity
      if (!Number.isInteger(count) || count < 1 || !fallback[offset]) break
      lines.push({ ...fallback[offset], quantity, quantity_unit: unit })
      offset += count
    }
    try {
      if (offset === fallback.length && lines.length === imported.length && JSON.stringify(shipmentParcelPayload(lines)) === JSON.stringify(shipmentParcelPayload(fallback))) return lines
    } catch { /* Retain individual persisted parcels when import metadata cannot be reconciled. */ }
  }
  return fallback
}
