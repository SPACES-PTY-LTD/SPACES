export type DwellTimeInput = {
  enteredAt?: string | null
  exitedAt?: string | null
  now?: string | number | Date | null
  expectedWaitingTime?: number | null
}

export type DwellTimeResult = {
  elapsedMinutes: number | null
  durationLabel: string
  isOpen: boolean
  isOverExpected: boolean
  overageMinutes: number | null
}

function timestamp(value?: string | number | Date | null): number | null {
  if (value === null || value === undefined || value === "") return null
  const milliseconds = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(milliseconds) ? milliseconds : null
}

export function elapsedMinutesBetween(
  start?: string | number | Date | null,
  end?: string | number | Date | null
): number | null {
  const startMilliseconds = timestamp(start)
  const endMilliseconds = timestamp(end)
  if (startMilliseconds === null || endMilliseconds === null) return null

  const elapsedMinutes = (endMilliseconds - startMilliseconds) / 60_000
  return elapsedMinutes >= 0 ? elapsedMinutes : null
}

export function formatDurationMinutes(elapsedMinutes: number | null): string {
  if (elapsedMinutes === null || !Number.isFinite(elapsedMinutes) || elapsedMinutes < 0) {
    return "-"
  }

  const totalMinutes = Math.round(elapsedMinutes)
  if (elapsedMinutes > 0 && totalMinutes === 0) return "< 1 min"

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} hr`
  return `${hours} hr ${minutes} min`
}

export function resolveDwellTime({
  enteredAt,
  exitedAt,
  now,
  expectedWaitingTime,
}: DwellTimeInput): DwellTimeResult {
  const isOpen = Boolean(enteredAt && !exitedAt)
  const effectiveEnd = exitedAt ?? (isOpen ? now : null)
  const elapsedMinutes = elapsedMinutesBetween(enteredAt, effectiveEnd)
  const hasExpectedWaitingTime =
    typeof expectedWaitingTime === "number" &&
    Number.isFinite(expectedWaitingTime) &&
    expectedWaitingTime >= 0
  const isOverExpected =
    elapsedMinutes !== null &&
    hasExpectedWaitingTime &&
    elapsedMinutes > expectedWaitingTime

  return {
    elapsedMinutes,
    durationLabel: formatDurationMinutes(elapsedMinutes),
    isOpen: isOpen && elapsedMinutes !== null,
    isOverExpected,
    overageMinutes: isOverExpected
      ? Math.max(1, Math.ceil(elapsedMinutes - expectedWaitingTime))
      : null,
  }
}

export function formatMinuteCount(value: number): string {
  return `${value} ${value === 1 ? "minute" : "minutes"}`
}
