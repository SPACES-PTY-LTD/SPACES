import type { RunTrack } from "@/lib/api/runs"
import type { ShipmentStop } from "@/lib/types"

export type ReplayPoint = { lat: number; lng: number; time: number }
export type ReplayEvent = { start: number; end: number; type: string; title: string; detail: string; position: ReplayPoint | null; priority: number }
export type ReplayModel = { start: number; end: number; segments: ReplayPoint[][]; events: ReplayEvent[]; gaps: { start: number; end: number }[] }
export const replayGapMs = 300_000
const timestamp = (value?: string | null) => value ? Date.parse(value) : NaN
function point(lat: number | null | undefined, lng: number | null | undefined, time: number): ReplayPoint | null {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && Number.isFinite(time) ? { lat, lng, time } : null
}
export function durationText(ms: number) {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return "< 1 min"
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours} hr${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`
}

// Preserve server segment boundaries: a pagination seam is not proof of a continuous track.
export function mergeTrackPages(pages: RunTrack[]): RunTrack | null {
  if (!pages.length) return null
  const latest = pages[0]
  const segments = pages.flatMap(page => page.segments).sort((a, b) => timestamp(a[0]?.observed_at) - timestamp(b[0]?.observed_at))
  const stops = [...new Map(pages.flatMap(page => page.stops).map(stop => [`${stop.first_seen_at}:${stop.latitude}:${stop.longitude}`, stop])).values()]
  return { ...latest, segments, stops, coverage: { ...latest.coverage,
    from: segments[0]?.[0]?.observed_at, to: segments.at(-1)?.at(-1)?.observed_at,
    displayed_coordinates: segments.reduce((count, segment) => count + segment.length, 0),
    next_before: pages.at(-1)!.coverage.next_before,
    partial: pages.some(page => page.coverage.partial),
  } }
}

export async function loadTrackPages(fetchPage: (before?: string) => Promise<RunTrack>, keepGoing: () => boolean = () => true) {
  const pages: RunTrack[] = [], cursors = new Set<string>()
  let before: string | undefined
  do {
    if (!keepGoing()) return { track: mergeTrackPages(pages), interrupted: true, error: null }
    try {
      const page = await fetchPage(before)
      pages.push(page)
      const next = page.coverage.next_before
      if (!next) return { track: mergeTrackPages(pages), interrupted: false, error: null }
      if (cursors.has(next)) throw new Error("History pagination did not advance. Retry to load the full trip.")
      cursors.add(next)
      before = next
    } catch (error) {
      return { track: mergeTrackPages(pages), interrupted: false, error: error instanceof Error ? error.message : "Could not load the whole trip." }
    }
  } while (true)
}

export function buildReplayModel(track: RunTrack | null, stops: ShipmentStop[], activities: ShipmentStop[] = []): ReplayModel | null {
  const segments: ReplayPoint[][] = []
  track?.segments.forEach(segment => {
    let current: ReplayPoint[] = []
    segment.forEach(sample => {
      const next = point(sample.latitude, sample.longitude, timestamp(sample.observed_at))
      // An invalid point is a break, never a bridge across missing data.
      if (!next || (current.length && (next.time <= current.at(-1)!.time || next.time - current.at(-1)!.time > replayGapMs))) {
        if (current.length) segments.push(current)
        current = []
      }
      if (next) current.push(next)
    })
    if (current.length) segments.push(current)
  })
  segments.sort((a, b) => a[0].time - b[0].time)
  const events: ReplayEvent[] = []
  const motions = activities.filter(activity => activity.event_type === "moving" || activity.event_type === "stopped").sort((a, b) => timestamp(a.occurred_at) - timestamp(b.occurred_at))
  const seen = new Set<string>()
  for (const stop of [...stops, ...activities.filter(activity => activity.event_type === "speeding")]) {
    if (stop.activity_id && seen.has(stop.activity_id)) continue
    if (stop.activity_id) seen.add(stop.activity_id)
    const start = timestamp(stop.entered_at ?? stop.occurred_at)
    if (!Number.isFinite(start)) continue
    let end = timestamp(stop.exited_at)
    let estimated = false
    if (!Number.isFinite(end) && stop.event_type === "stopped" && stop.vehicle?.vehicle_id && stop.run_id) {
      const motion = motions.find(activity => activity.vehicle?.vehicle_id === stop.vehicle?.vehicle_id && activity.run_id === stop.run_id && timestamp(activity.occurred_at) > start)
      if (motion?.event_type === "moving") { end = timestamp(motion.occurred_at); estimated = true }
    }
    const type = stop.event_type || "run_stop"
    const name = stop.location?.name || stop.location?.company || stop.location?.full_address || "Unknown location"
    const role = type === "shipment_delivery" ? "Delivery" : type === "shipment_collection" ? "Collection" : type === "speeding" ? "Speeding" : type === "entered_location" ? "Location visit" : "Stop"
    const hasInterval = Number.isFinite(end) && end > start
    const detail = type === "speeding" ? [stop.speed_kph != null ? `${stop.speed_kph} km/h` : "Speed not recorded", stop.speed_limit_kph != null ? `Limit ${stop.speed_limit_kph} km/h` : null].filter(Boolean).join(" · ")
      : hasInterval ? `${type === "entered_location" ? "At location" : "Stopped"} ${durationText(end - start)}${estimated ? " (estimated)" : ""}` : "Duration not recorded"
    events.push({ start, end: hasInterval ? end : start, type, title: `${role} · ${name}`, detail,
      position: point(stop.latitude ?? stop.location?.latitude, stop.longitude ?? stop.location?.longitude, start),
      priority: type === "speeding" ? 5 : type === "shipment_delivery" ? 4 : type === "shipment_collection" ? 3 : 2 })
  }
  track?.stops.forEach(stop => {
    const start = timestamp(stop.first_seen_at), end = timestamp(stop.last_seen_at)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return
    events.push({ start, end, type: "stationary_gps", title: "Stationary · Unknown location", detail: `Observed stationary ${durationText(end - start)} · Reason not recorded`, position: point(stop.latitude, stop.longitude, start), priority: 1 })
  })
  events.sort((a, b) => a.start - b.start)
  const times = [...segments.flatMap(segment => [segment[0].time, segment.at(-1)!.time]), ...events.flatMap(event => [event.start, event.end])]
  if (!times.length) return null
  const start = times.reduce((a, b) => Math.min(a, b)), end = times.reduce((a, b) => Math.max(a, b))
  // Union observed route/stop intervals, then expose the uncovered periods on the rail.
  const coverage = [...segments.map(segment => ({ start: segment[0].time, end: segment.at(-1)!.time })), ...events.filter(event => event.end > event.start && event.position).map(event => ({ start: event.start, end: event.end }))].sort((a, b) => a.start - b.start)
  const gaps: ReplayModel["gaps"] = []
  let covered = start
  coverage.forEach(interval => { if (interval.start > covered) gaps.push({ start: covered, end: interval.start }); covered = Math.max(covered, interval.end) })
  if (covered < end) gaps.push({ start: covered, end })
  return { start, end, segments, events, gaps }
}

export function replayAt(model: ReplayModel, selected: number) {
  // Point events are highlighted briefly after their timestamp, never before they happened.
  const event = model.events.filter(event => selected >= event.start && selected <= (event.end > event.start ? event.end : event.start + 30_000))
    .sort((a, b) => b.priority - a.priority || b.start - a.start)[0]
  let position: ReplayPoint | null = null
  if (event && event.end > event.start && event.type !== "speeding") position = event.position
  else {
    for (const segment of model.segments) {
      if (selected < segment[0].time || selected > segment.at(-1)!.time) continue
      let low = 0, high = segment.length - 1
      while (low < high) { const mid = Math.floor((low + high) / 2); if (segment[mid].time < selected) low = mid + 1; else high = mid }
      const right = segment[low], left = segment[Math.max(0, low - 1)]
      const ratio = right.time === left.time ? 0 : (selected - left.time) / (right.time - left.time)
      position = { lat: left.lat + (right.lat - left.lat) * ratio, lng: left.lng + (right.lng - left.lng) * ratio, time: selected }
      break
    }
    if (!position && event && selected === event.start) position = event.position
  }
  return { position, event, title: event?.title ?? (position ? "Travelling" : "No GPS data"),
    detail: event ? `${event.detail}${!position ? " · Position unavailable" : ""}` : position ? "Replay position estimated between recorded GPS samples" : "Position unavailable for this time; the vehicle is hidden across this gap." }
}
