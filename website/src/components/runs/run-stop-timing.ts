import type { ShipmentStop } from "@/lib/types"
import { elapsed, stoppedDuration } from "@/components/runs/run-map-markers"

export function runStopTiming(stop: ShipmentStop, activities: ShipmentStop[] = [], now = Date.now()) {
  const stopped = stoppedDuration(stop, activities, now)
  if (stopped) return { durationLabel: stopped, tooltip: null }
  const duration = elapsed(stop.entered_at, stop.exited_at)
  const expected = stop.location?.expected_waiting_time
  const milliseconds = duration === null ? null : Date.parse(stop.exited_at!) - Date.parse(stop.entered_at!)
  const overExpected = milliseconds !== null && typeof expected === "number"
    && Number.isFinite(expected) && expected >= 0 && milliseconds > expected * 60_000
  const overage = overExpected ? elapsed(stop.entered_at, new Date(Date.parse(stop.exited_at!) - expected * 60_000).toISOString()) : null

  return {
    durationLabel: duration ?? "Not available",
    tooltip: overExpected
      ? `Total time at this location was ${duration}, exceeding the expected waiting time of ${expected} ${expected === 1 ? "minute" : "minutes"} by ${overage}.`
      : null,
  }
}
