import {
  elapsedMinutesBetween,
  formatDurationMinutes,
  formatMinuteCount,
  resolveDwellTime,
} from "@/lib/dwell-time"

export type ShipmentAttentionCode =
  | "undelivered_over_6_hours"
  | "speeding"
  | "pickup_dwell_over_expected"
  | "dropoff_dwell_over_expected"

export type ShipmentAttentionAlert = {
  code: ShipmentAttentionCode
  tooltip: string
  tone: "warning" | "danger"
}

export type ShipmentAttentionInput = {
  shipmentStatus?: string | null
  collectedAt?: string | null
  deliveredAt?: string | null
  speedingAlertCount?: number | null
  speedingHighestSpeedKph?: number | null
  speedingMaxOverLimitKph?: number | null
  speedingLatestAt?: string | null
  pickupEnteredAt?: string | null
  pickupExitedAt?: string | null
  pickupExpectedWaitingTime?: number | null
  dropoffEnteredAt?: string | null
  dropoffExitedAt?: string | null
  dropoffExpectedWaitingTime?: number | null
  now: string | number | Date
}

const TERMINAL_STATUSES = new Set([
  "delivered",
  "cancelled",
  "failed",
  "offer_failed",
])
const UNDELIVERED_THRESHOLD_MINUTES = 6 * 60

function hasDeliveryCompletionEvidence(input: ShipmentAttentionInput, status: string): boolean {
  return Boolean(
    input.deliveredAt ||
    input.dropoffExitedAt ||
    TERMINAL_STATUSES.has(status)
  )
}

function formatKph(value: number): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} km/h`
}

function formatUtcTimestamp(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`
}

function dwellAlert(
  kind: "pickup" | "dropoff",
  enteredAt: string | null | undefined,
  exitedAt: string | null | undefined,
  expectedWaitingTime: number | null | undefined,
  now: ShipmentAttentionInput["now"]
): ShipmentAttentionAlert | null {
  const dwell = resolveDwellTime({
    enteredAt,
    exitedAt,
    expectedWaitingTime,
    now,
  })
  if (!dwell.isOverExpected || dwell.elapsedMinutes === null || dwell.overageMinutes === null) {
    return null
  }

  const label = kind === "pickup" ? "Pickup" : "Drop-off"
  const tense = dwell.isOpen ? "is" : "was"
  return {
    code: kind === "pickup"
      ? "pickup_dwell_over_expected"
      : "dropoff_dwell_over_expected",
    tone: "danger",
    tooltip: `${label} total time ${tense} ${formatDurationMinutes(dwell.elapsedMinutes)}, ${formatMinuteCount(dwell.overageMinutes)} over the expected waiting time of ${formatMinuteCount(expectedWaitingTime as number)}.`,
  }
}

export function hasOpenShipmentAttentionTiming(input: ShipmentAttentionInput): boolean {
  const status = input.shipmentStatus?.toLowerCase() ?? ""
  const hasActiveDeliveryWindow = Boolean(
    input.collectedAt &&
    !hasDeliveryCompletionEvidence(input, status)
  )

  return hasActiveDeliveryWindow || Boolean(
    (input.pickupEnteredAt && !input.pickupExitedAt) ||
    (input.dropoffEnteredAt && !input.dropoffExitedAt)
  )
}

export function resolveShipmentAttention(input: ShipmentAttentionInput): ShipmentAttentionAlert[] {
  const alerts: ShipmentAttentionAlert[] = []
  const status = input.shipmentStatus?.toLowerCase() ?? ""
  const activeUndelivered = Boolean(
    input.collectedAt &&
    !hasDeliveryCompletionEvidence(input, status)
  )
  const collectedElapsed = activeUndelivered
    ? elapsedMinutesBetween(input.collectedAt, input.now)
    : null

  if (collectedElapsed !== null && collectedElapsed > UNDELIVERED_THRESHOLD_MINUTES) {
    const dropoffElapsed = input.dropoffEnteredAt && !input.dropoffExitedAt
      ? elapsedMinutesBetween(input.dropoffEnteredAt, input.now)
      : null
    const deliveryState = dropoffElapsed !== null
      ? `Arrived at the drop-off ${formatDurationMinutes(dropoffElapsed)} ago, but delivery is not complete.`
      : `Collected ${formatDurationMinutes(collectedElapsed)} ago and has not yet reached the drop-off.`

    alerts.push({
      code: "undelivered_over_6_hours",
      tone: "warning",
      tooltip: `${deliveryState} Collection was ${formatDurationMinutes(collectedElapsed)} ago (${formatDurationMinutes(collectedElapsed - UNDELIVERED_THRESHOLD_MINUTES)} over the 6 hr threshold).`,
    })
  }

  const speedingCount = Number(input.speedingAlertCount ?? 0)
  if (Number.isFinite(speedingCount) && speedingCount > 0) {
    const details = [`${speedingCount} speeding ${speedingCount === 1 ? "alert" : "alerts"} during transit.`]
    if (typeof input.speedingHighestSpeedKph === "number") {
      details.push(`Highest speed: ${formatKph(input.speedingHighestSpeedKph)}.`)
    }
    if (typeof input.speedingMaxOverLimitKph === "number") {
      details.push(`Maximum over limit: ${formatKph(input.speedingMaxOverLimitKph)}.`)
    }
    const latestAt = formatUtcTimestamp(input.speedingLatestAt)
    if (latestAt) {
      details.push(`Latest: ${latestAt}.`)
    }
    alerts.push({
      code: "speeding",
      tone: "danger",
      tooltip: details.join(" "),
    })
  }

  const pickup = dwellAlert(
    "pickup",
    input.pickupEnteredAt,
    input.pickupExitedAt,
    input.pickupExpectedWaitingTime,
    input.now
  )
  if (pickup) alerts.push(pickup)

  const dropoff = dwellAlert(
    "dropoff",
    input.dropoffEnteredAt,
    input.dropoffExitedAt,
    input.dropoffExpectedWaitingTime,
    input.now
  )
  if (dropoff) alerts.push(dropoff)

  return alerts
}

export function summarizeShipmentAttention(alerts: ShipmentAttentionAlert[]): string {
  return alerts.map((alert) => alert.tooltip).join(" | ")
}
