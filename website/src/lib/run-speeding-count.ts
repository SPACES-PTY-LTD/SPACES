type RunSpeedingData = {
  speeding_alert_count?: unknown
  safety?: { speeding_event_count?: unknown; speeding_events?: unknown } | null
}

export function runSpeedingCount(run: RunSpeedingData): number | null {
  for (const value of [run.speeding_alert_count, run.safety?.speeding_event_count]) {
    if (typeof value !== "number" && typeof value !== "string") continue
    if (typeof value === "string" && value.trim() === "") continue
    const count = Number(value)
    if (Number.isSafeInteger(count) && count >= 0) return count
  }
  return Array.isArray(run.safety?.speeding_events) ? run.safety.speeding_events.length : null
}
