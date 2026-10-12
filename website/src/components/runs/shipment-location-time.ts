import type { ShipmentStop } from "@/lib/types"
import { formatDurationMinutes } from "@/lib/dwell-time"

export function shipmentLocationTime(stops: ShipmentStop[], locationId: string | undefined, {
  now, startedAt, completedAt, isActive, vehicleId,
}: { now: string; startedAt?: string | null; completedAt?: string | null; isActive: boolean; vehicleId?: string }) {
  const intervals: [number, number][] = []
  let isOpen = false
  const runStart = startedAt ? Date.parse(startedAt) : null
  const runEnd = completedAt ? Date.parse(completedAt) : null
  for (const stop of stops) {
    if (!locationId || stop.location?.location_id !== locationId || stop.event_type !== "entered_location") continue
    if (vehicleId && stop.vehicle?.vehicle_id !== vehicleId) continue
    const start = Date.parse(stop.entered_at ?? "")
    const end = Date.parse(stop.exited_at ?? (isActive ? now : completedAt ?? ""))
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue
    const boundedStart = runStart !== null && Number.isFinite(runStart) ? Math.max(start, runStart) : start
    const boundedEnd = runEnd !== null && Number.isFinite(runEnd) ? Math.min(end, runEnd) : end
    if (boundedEnd < boundedStart) continue
    intervals.push([boundedStart, boundedEnd])
    if (!stop.exited_at && isActive && !completedAt) isOpen = true
  }
  if (!intervals.length) return { label: "Not available", isOpen: false }
  // Count overlapping/repeated observations once, while retaining separate visits.
  intervals.sort((a, b) => a[0] - b[0])
  let [start, end] = intervals[0]
  let total = 0
  for (const [nextStart, nextEnd] of intervals.slice(1)) {
    if (nextStart <= end) end = Math.max(end, nextEnd)
    else { total += end - start; start = nextStart; end = nextEnd }
  }
  total += end - start
  return { label: formatDurationMinutes(total / 60_000), isOpen }
}
