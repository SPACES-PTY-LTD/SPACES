import type { ScheduleItem, ScheduleRun } from "@/lib/api/schedule"

export function eligibleRun(item: ScheduleItem, run: ScheduleRun) {
  if (item.kind === "driver") return run.can_assign_driver
  if (item.shipment.source_run_id === run.run_id) return false
  return run.can_add_shipment && (!item.shipment.source_run_id || run.status !== "in_progress")
}
export function dateInTimezone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}
export function shiftDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}
/** Convert merchant wall time without assuming the browser's timezone. */
export function merchantTimeToIso(value: string, timezone: string) {
  const desired = Date.parse(`${value}:00Z`)
  if (!Number.isFinite(desired)) throw new Error("Enter a valid planned start time.")
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
  const wallTime = (timestamp: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]))
    return Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`)
  }
  let candidate = desired
  for (let attempt = 0; attempt < 3; attempt++) candidate += desired - wallTime(candidate)
  if (wallTime(candidate) !== desired) throw new Error("This time does not exist in the merchant’s timezone. Choose another time.")
  return new Date(candidate).toISOString()
}
