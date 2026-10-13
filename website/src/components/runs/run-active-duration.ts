export function runActiveDuration(status: string | null | undefined, startedAt: string | null | undefined, completedAt: string | null | undefined, now: number): string {
  if (!startedAt) return "-"
  const start = Date.parse(startedAt)
  const end = status === "in_progress" ? now : completedAt ? Date.parse(completedAt) : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end) || (status !== "in_progress" && end < start)) return "-"
  const minutes = Math.floor(Math.max(0, end - start) / 60000)
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
