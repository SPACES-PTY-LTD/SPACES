import type { TruckRender } from "./types";

export function getTruckWaitingState(truck: TruckRender, now: number) {
  const since = truck.waitingSinceMs === undefined ? truck.changedAt : truck.waitingSinceMs;
  const allowed = truck.maxWaitingMs;
  const isAtStop = truck.status === "parked" &&
    truck.locationId !== "ON_ROAD" && truck.locationId !== "PARKING_UNKNOWN";
  const waitingDurationMs = isAtStop && since !== null && Number.isFinite(since) && since <= now
    ? now - since : undefined;
  const isWaitingOverdue = waitingDurationMs !== undefined && allowed !== undefined &&
    Number.isFinite(allowed) && allowed >= 0 && waitingDurationMs > allowed;
  return {
    waitingDurationMs,
    isWaitingOverdue,
    overdueByMs: isWaitingOverdue ? waitingDurationMs! - allowed! : 0
  };
}

export function formatWaitingMinutes(ms: number): string {
  // Keep sub-minute overruns visible without rounding up a full minute.
  const minutes = Math.floor(ms / 60_000);
  return minutes === 0 && ms > 0 ? "less than 1 minute" : `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}
