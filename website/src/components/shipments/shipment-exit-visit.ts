import type { ShipmentStop } from "@/lib/types"

// Automated exit activities carry the actual visit interval in metadata;
// their top-level visit timestamps are normally empty.
export function shipmentExitVisit(stop: ShipmentStop): ShipmentStop {
  const enteredAt = stop.metadata?.entered_at
  const exitedAt = stop.metadata?.exited_at
  return {
    ...stop,
    entered_at: typeof enteredAt === "string" ? enteredAt : stop.entered_at,
    exited_at: typeof exitedAt === "string" ? exitedAt : stop.exited_at,
  }
}
