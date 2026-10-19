import type { RunTrack } from "@/lib/api/runs"
import type { ShipmentStop } from "@/lib/types"

export type RunMapMarker = {
  position: { lat: number; lng: number }
  label?: string
  observedAt?: string | null
  type: string
  locationId?: string
  title: string
  rows: [string, string][]
}

export function eventLabel(value: string) {
  return value.replaceAll("_", " ").replace(/^./, character => character.toUpperCase())
}

function time(value?: string | null) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString(undefined, { timeZoneName: "short" })
    : "Not recorded"
}

export function elapsed(start?: string | null, end?: string | null) {
  if (!start || !end) return null
  const seconds = Math.floor((Date.parse(end) - Date.parse(start)) / 1000)
  if (!Number.isFinite(seconds) || seconds < 0) return null
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor(seconds % 86400 / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`, (seconds % 60 || seconds === 0) && `${seconds % 60}s`].filter(Boolean).join(" ")
}

/** New persisted observations take precedence over legacy transition estimates. */
export function stoppedDuration(stop: ShipmentStop, activities: ShipmentStop[] = [], now = Date.now()): string | null {
  if (stop.event_type !== "stopped") return null
  const timing = stop.metadata?.stop_timing as Record<string, unknown> | undefined
  if (timing) {
    const start = typeof timing.started_at === "string" ? timing.started_at : null
    const last = typeof timing.last_confirmed_at === "string" ? timing.last_confirmed_at : null
    const end = typeof timing.departed_at === "string" ? timing.departed_at : null
    const observed = elapsed(start, last)
    if (!observed) return "Duration unknown — invalid stop observations"
    if (timing.status === "completed" && end && last && Date.parse(end) >= Date.parse(last)) {
      const duration = elapsed(start, end)
      if (duration) return `${duration} (recorded from tracker)`
    }
    const gapSeconds = typeof timing.gap_seconds === "number" ? timing.gap_seconds : 300
    const fresh = last && now >= Date.parse(last) && now - Date.parse(last) <= gapSeconds * 1000
    const confirmed = last ? new Date(last).toISOString().replace("T", " ").replace(".000Z", " UTC") : "unknown"
    if (timing.status === "open" && fresh && !timing.moving_at) {
      return `At least ${observed} · stationary at last report (${confirmed})`
    }
    const reason = timing.status === "open" && timing.moving_at && fresh ? "departure awaiting confirmation"
      : timing.reason === "run_changed" ? "run changed; departure not recorded"
      : timing.reason === "position_changed" ? "position changed; departure not recorded"
      : "tracking incomplete"
    return `At least ${observed} · ${reason} · last confirmed ${confirmed}`
  }
  if (elapsed(stop.entered_at, stop.exited_at) !== null) return null
  const next = stop.occurred_at && stop.vehicle?.vehicle_id && stop.run_id ? activities
    .filter(activity => ["stopped", "moving"].includes(activity.event_type ?? "")
      && activity.vehicle?.vehicle_id === stop.vehicle?.vehicle_id && activity.run_id === stop.run_id
      && Date.parse(activity.occurred_at ?? "") > Date.parse(stop.occurred_at!))
    .sort((a, b) => Date.parse(a.occurred_at!) - Date.parse(b.occurred_at!))[0] : undefined
  const duration = next?.event_type === "moving" ? elapsed(stop.occurred_at, next.occurred_at) : null
  return duration ? `${duration} (estimated from stopped → moving events)` : "Duration unknown — departure not recorded"
}

function position(latitude?: number | null, longitude?: number | null) {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { lat: latitude, lng: longitude }
}

function coordinates(point: { lat: number; lng: number }): [string, string] {
  return ["Coordinates", `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`]
}

export function buildRunMapMarkers(stops: ShipmentStop[], track: RunTrack | null, activities: ShipmentStop[] = []): RunMapMarker[] {
  const markers: RunMapMarker[] = stops.flatMap((stop, index) => {
    const point = position(stop.latitude ?? stop.location?.latitude, stop.longitude ?? stop.location?.longitude)
    if (!point) return []
    const type = stop.event_type || "run_stop"
    const location = stop.location
    const rows: [string, string][] = [
      ["Event", eventLabel(type)],
      ["Location", location?.name || location?.company || location?.code || "Unknown location"],
      ["Location category", location?.type?.title || (location?.type?.slug ? eventLabel(location.type.slug) : "Not recorded")],
    ]
    const address = location?.full_address || [location?.city, location?.province, location?.country].filter(Boolean).join(", ")
    if (address) rows.push(["Address", address])
    if (location?.company && location.company !== location.name) rows.push(["Company", location.company])
    if (location?.code) rows.push(["Location code", location.code])
    rows.push(["Event time", time(stop.occurred_at)], ["Arrival", time(stop.entered_at)], ["Departure", time(stop.exited_at)])
    const timing = stop.metadata?.stop_timing as Record<string, unknown> | undefined
    if (type === "stopped" && timing) {
      for (const [label, key] of [["Stopped at", "started_at"], ["Last stationary report", "last_confirmed_at"], ["Recorded departure", "departed_at"]]) {
        rows.push([label, time(typeof timing[key] === "string" ? timing[key] as string : null)])
      }
    }
    const visitDuration = elapsed(stop.entered_at, stop.exited_at)
    rows.push(["Time at stop", stoppedDuration(stop, activities) ?? visitDuration ?? "Unknown — complete arrival/departure times not recorded"])
    if (stop.exit_reason) rows.push(["Departure reason", eventLabel(stop.exit_reason)])
    if (stop.shipment) {
      rows.push(["Shipment", stop.shipment.merchant_order_ref || stop.shipment.shipment_id || "Reference unavailable"])
      if (stop.shipment.status) rows.push(["Current shipment status", eventLabel(stop.shipment.status)])
    }
    if (stop.driver?.name) rows.push(["Driver", stop.driver.name])
    if (stop.vehicle?.plate_number) rows.push(["Vehicle", stop.vehicle.plate_number])
    if (stop.speed_kph != null) rows.push(["Recorded speed", `${stop.speed_kph} km/h`])
    if (stop.speed_limit_kph != null) rows.push(["Speed limit", `${stop.speed_limit_kph} km/h`])
    rows.push(coordinates(point))
    return [{ locationId: location?.location_id, observedAt: stop.entered_at ?? stop.occurred_at, position: point, label: String(index + 1), type, title: `${eventLabel(type)} · ${location?.name || location?.company || "Unknown location"}`, rows }]
  })
  const knownIds = new Set(stops.map(stop => stop.activity_id).filter(Boolean))
  const speeding = activities.filter(activity => activity.event_type === "speeding" && (!activity.activity_id || !knownIds.has(activity.activity_id)))
  if (speeding.length) markers.push(...buildRunMapMarkers(speeding, null).map(marker => ({ ...marker, label: undefined })))
  track?.stops.forEach(stop => {
    const point = position(stop.latitude, stop.longitude)
    if (!point) return
    markers.push({ observedAt: stop.first_seen_at, position: point, type: "stationary_gps", title: "Stationary GPS observation", rows: [
      ["Activity", "Truck observed stationary"],
      ["Observed stationary time", elapsed(stop.first_seen_at, stop.last_seen_at) ?? "Unknown"],
      ["First observation", time(stop.first_seen_at)], ["Last observation", time(stop.last_seen_at)],
      ["GPS samples", String(stop.sample_count)],
      ["Context", "GPS observations only; exact arrival, departure and reason for stopping are not recorded."],
      ["Location category", "Unknown — no linked location"], coordinates(point),
    ] })
  })
  track?.segments.forEach(segment => {
    if (segment.length !== 1) return
    const sample = segment[0]
    const point = position(sample.latitude, sample.longitude)
    if (point) markers.push({ position: point, type: "recorded_position", title: "Recorded GPS position", rows: [
      ["Observed at", time(sample.observed_at)],
      ["Context", "Isolated GPS position; this does not establish a stop or its duration."], coordinates(point),
    ] })
  })
  return markers
}

// Use textContent so provider/location text is never interpreted as HTML.
export function markerDetails(markers: RunMapMarker[], onLocation?: (id: string, name: string) => void) {
  const content = document.createElement("div")
  content.style.cssText = "max-width:320px;max-height:300px;overflow:auto;color:#0f172a;font:13px/1.5 system-ui;overflow-wrap:anywhere"
  markers.forEach(marker => {
    const section = document.createElement("section")
    section.style.cssText = "padding:8px 0;border-bottom:1px solid #e2e8f0"
    const heading = document.createElement("h3")
    heading.style.cssText = "font-size:15px;font-weight:600;margin:0 0 8px"
    heading.textContent = `${marker.label ? `Stop ${marker.label} · ` : ""}${marker.title}`
    section.append(heading)
    const list = document.createElement("dl")
    list.style.margin = "0"
    marker.rows.forEach(([label, value]) => {
      const term = document.createElement("dt")
      term.style.cssText = "font-weight:600;margin-top:6px"
      term.textContent = label
      const detail = document.createElement("dd")
      detail.style.margin = "0"
      if (label === "Location" && marker.locationId && onLocation) {
        const button = document.createElement("button")
        button.type = "button"
        button.textContent = value
        button.setAttribute("aria-label", `View location details for ${value}`)
        button.style.cssText = "text-decoration:underline;text-underline-offset:4px;color:#2563eb;cursor:pointer;text-align:left"
        button.addEventListener("click", () => onLocation(marker.locationId!, value))
        detail.append(button)
      } else detail.textContent = value
      list.append(term, detail)
    })
    section.append(list)
    content.append(section)
  })
  return content
}

export const markerCategories = [
  { title: "Collection", color: "#2563eb", symbol: "C" },
  { title: "Delivery", color: "#15803d", symbol: "D" },
  { title: "Other stop", color: "#64748b", symbol: "S" },
  { title: "Speeding", color: "#dc2626", symbol: "!" },
  { title: "GPS position", color: "#7c3aed", symbol: "P" },
] as const

export function markerAppearance(type: string) {
  if (type === "shipment_collection") return markerCategories[0]
  if (type === "shipment_delivery") return markerCategories[1]
  if (type === "speeding") return markerCategories[3]
  if (type === "recorded_position") return markerCategories[4]
  return markerCategories[2]
}

export function latestStopMarker(markers: RunMapMarker[]) {
  return markers.filter(marker => ["stopped", "entered_location", "shipment_collection", "shipment_delivery", "run_stop", "stationary_gps"].includes(marker.type)
    && Number.isFinite(Date.parse(marker.observedAt ?? "")))
    .reduce<RunMapMarker | null>((latest, marker) => !latest || Date.parse(marker.observedAt!) > Date.parse(latest.observedAt!) ? marker : latest, null)
}

// Keep every observation for details/replay, but display one pin per exact coordinate.
export function visibleRunMapMarkers(markers: RunMapMarker[], hiddenTypes: string[] = [], isReplaying = false) {
  const byPosition = new Map<string, RunMapMarker>()
  const priority = (marker: RunMapMarker) => marker.type === "latest_stop" ? 4
    : marker.type === "speeding" ? 3
    : ["recorded_position", "stationary_gps"].includes(marker.type) ? 1 : 2
  for (const marker of markers) {
    if (hiddenTypes.includes(marker.type) || (isReplaying && marker.type === "latest_stop")) continue
    const key = `${marker.position.lat},${marker.position.lng}`
    const current = byPosition.get(key)
    if (!current || priority(marker) > priority(current)) byPosition.set(key, marker)
  }
  return new Set(byPosition.values())
}
