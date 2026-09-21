"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"
import { getRunTrack, type RunTrack } from "@/lib/api/runs"
import { isApiErrorResponse } from "@/lib/api/client"
import { RunTripTimeline } from "./run-trip-timeline"
import { buildReplayModel, loadTrackPages, replayAt } from "./run-replay"
import type { ShipmentStop } from "@/lib/types"
import { ChevronDown, Filter } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { buildRunMapMarkers, eventLabel, markerDetails, markerAppearance, latestStopMarker } from "./run-map-markers"

type Props = { runId: string; accessToken?: string | null; stops: ShipmentStop[]; activities?: ShipmentStop[] }

export function RunActualMap({ runId, accessToken, stops, activities }: Props) {
  const [mapElement, setMapElement] = React.useState<HTMLDivElement | null>(null)
  const [visible, setVisible] = React.useState(false)
  const container = React.useRef<HTMLDivElement>(null)
  const [retry, setRetry] = React.useState(0)
  const [result, setResult] = React.useState<{ key: string; track: RunTrack } | null>(null)
  const [failure, setFailure] = React.useState<{ key: string; message: string | null } | null>(null)
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null)
  const [checkedAt, setCheckedAt] = React.useState(0)
  const mapInstance = React.useRef<{ element: HTMLDivElement; map: google.maps.Map } | null>(null)
  const fittedKey = React.useRef<string | null>(null)
  const [mapError, setMapError] = React.useState<string | null>(null)
  const key = `${accessToken}:${runId}`
  const error = failure?.key === key ? failure.message : null
  const loading = loadingKey === key
  const track = result?.key === key ? result.track : null
  const markers = React.useMemo(() => {
    const events = buildRunMapMarkers(stops, track, activities)
    const latest = latestStopMarker(events)
    if (latest) events.push({ ...latest, type: "latest_stop", label: undefined, title: "Latest mapped stop", rows: [["Position", "Latest dated stop with coordinates in the available history; not a live vehicle position."], ...latest.rows] })
    return events
  }, [stops, track, activities])
  const model = React.useMemo(() => buildReplayModel(track, stops, activities), [track, stops, activities])
  const [selection, setSelection] = React.useState<{ key: string; time: number | null } | null>(null)
  const selected = selection?.key === key ? selection.time : null
  const isReplaying = selected !== null
  const replay = React.useMemo(() => model && selected !== null ? replayAt(model, Math.max(model.start, Math.min(model.end, selected))) : null, [model, selected])
  const replayCar = React.useRef<google.maps.Marker | null>(null)
  const [mapRevision, setMapRevision] = React.useState(0)
  const [filter, setFilter] = React.useState<{ runId: string; hidden: string[] }>({ runId, hidden: [] })
  const hiddenTypes = React.useMemo(() => filter.runId === runId ? filter.hidden : [], [filter, runId])
  const markerTypes = React.useMemo(() => [...new Set(markers.map(marker => marker.type))], [markers])
  const shownCount = markers.filter(marker => !hiddenTypes.includes(marker.type)).length
  const markerHandles = React.useRef<{ marker: google.maps.Marker; type: string }[]>([])
  const infoWindow = React.useRef<google.maps.InfoWindow | null>(null)
  const hiddenRef = React.useRef(hiddenTypes)
  React.useEffect(() => {
    hiddenRef.current = hiddenTypes
    markerHandles.current.forEach(({ marker, type }) => marker.setVisible(!hiddenTypes.includes(type) && !(type === "latest_stop" && isReplaying)))
    infoWindow.current?.close()
  }, [hiddenTypes, isReplaying, mapRevision])
  const hasTrack = Boolean(track?.segments.some(segment => segment.length))
  const hasMap = hasTrack || markers.length > 0
  React.useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    if (container.current) observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  React.useEffect(() => {
    if (!visible) return
    let cancelled = false, pending = false, active = true
    const refresh = async () => {
      if (pending || document.hidden) return
      pending = true
      setLoadingKey(key)
      const response = await loadTrackPages(async before => {
        const page = await getRunTrack(runId, accessToken, before)
        if (isApiErrorResponse(page)) throw new Error(page.message)
        return page
      }, () => !cancelled && !document.hidden)
      pending = false
      if (cancelled) return
      setLoadingKey(null)
      setCheckedAt(Date.now())
      if (response.interrupted) return
      if (response.track) {
        active = response.track.active
        const nextTrack = response.track
        setResult(previous => response.error && previous?.key === key ? previous : { key, track: nextTrack })
      }
      setFailure({ key, message: response.error })
    }
    void refresh()
    const timer = window.setInterval(() => { if (active) void refresh() }, 60000)
    const onVisible = () => { if (active) void refresh() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible) }
  }, [runId, accessToken, key, visible, retry])
  React.useEffect(() => {
    const car = replayCar.current
    if (!car) return
    car.setVisible(Boolean(replay?.position))
    if (replay?.position) {
      car.setPosition(replay.position)
      car.setTitle(`Replay position · ${replay.title} · ${replay.detail}`)
    }
    infoWindow.current?.close()
  }, [replay, mapRevision])
  React.useEffect(() => {
    if (!mapElement || !hasMap) return
    let cancelled = false
    const listeners: google.maps.MapsEventListener[] = []
    const overlays: (google.maps.Marker | google.maps.Polyline)[] = []
    loadGoogleMaps([]).then(() => {
      if (cancelled) return
      setMapError(null)
      if (mapInstance.current?.element !== mapElement) fittedKey.current = null
      const map = mapInstance.current?.element === mapElement ? mapInstance.current.map : new google.maps.Map(mapElement, { center: { lat: 0, lng: 0 }, zoom: 12, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, styles: [
        { featureType: "all", elementType: "geometry", stylers: [{ color: "#f0f1f3" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#dce0e5" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
      ] })
      mapInstance.current = { element: mapElement, map }
      const details = new google.maps.InfoWindow({ maxWidth: 350 })
      infoWindow.current = details
      replayCar.current = new google.maps.Marker({ map, visible: false, zIndex: 1100, icon: vehicleIcon(), title: "Replay position" })
      overlays.push(replayCar.current)
      const bounds = new google.maps.LatLngBounds()
      track?.segments.forEach(segment => {
        const path = segment.map(p => ({ lat: p.latitude, lng: p.longitude }))
        path.forEach(p => bounds.extend(p))
        if (path.length > 1) overlays.push(new google.maps.Polyline({ map, path, strokeColor: "#2563eb", strokeWeight: 4 }))
      })
      markerHandles.current = markers.map(item => {
        bounds.extend(item.position)
        const appearance = markerAppearance(item.type)
        const isVehicle = item.type === "latest_stop"
        const marker = new google.maps.Marker({
          map, position: item.position, title: item.title,
          visible: !hiddenRef.current.includes(item.type),
          zIndex: isVehicle ? 1000 : item.type === "speeding" ? 900 : undefined,
          label: isVehicle ? undefined : { text: item.label || appearance.symbol, color: "#ffffff", fontSize: "12px", fontWeight: "600" },
          icon: isVehicle ? vehicleIcon() : {
            path: google.maps.SymbolPath.CIRCLE, scale: 14,
            fillColor: appearance.color, fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2,
          },
        })
        overlays.push(marker)
        listeners.push(marker.addListener("click", () => {
          // Include overlapping events/visits so a pin cannot conceal another stop's details.
          const atPosition = markers.filter(other => other.position.lat === item.position.lat && other.position.lng === item.position.lng && !hiddenRef.current.includes(other.type))
          details.setContent(markerDetails(atPosition))
          details.open({ map, anchor: marker })
        }))
        return { marker, type: item.type }
      })
      const fitKey = `${key}:${track ? "history" : "stops"}`
      if (!bounds.isEmpty() && fittedKey.current !== fitKey) { map.fitBounds(bounds, 64); fittedKey.current = fitKey }
      setMapRevision(value => value + 1)
    }).catch(() => { if (!cancelled) setMapError("Map unavailable. Try again.") })
    return () => { cancelled = true; listeners.forEach(listener => listener.remove()); infoWindow.current?.close(); infoWindow.current = null; markerHandles.current = []; replayCar.current = null; overlays.forEach(overlay => overlay.setMap(null)) }
  }, [mapElement, track, markers, hasMap, retry, key])
  const stale = track?.active && track.latest_observed_at && checkedAt - Date.parse(track.latest_observed_at) > 300000
  return <div ref={container} className="space-y-3">
      {(error || stale) && <p role="status" className="text-sm text-amber-700">{error ? `${track ? "Showing previous data. " : ""}${error}` : "Tracking is stale; showing the last recorded route."}</p>}
      {mapError && <p role="alert" className="text-sm text-destructive">{mapError}</p>}
      {!hasTrack && <p role="status" className="text-sm text-muted-foreground">{track?.status === "disabled" ? "Recorded route display is not enabled." : track ? "No GPS history recorded for this run. The route taken is unavailable." : error ? "Route unavailable." : "Loading recorded route…"}</p>}
      {hasMap ? <div className="overflow-hidden rounded-lg border">
        <div className="relative">
        <div ref={setMapElement} className="h-[380px] w-full sm:h-[480px]" aria-label="Run stops and recorded GPS route map" />
        <div className="absolute right-3 top-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" className="bg-background shadow-sm"><Filter className="size-4" />Marker types ({shownCount}/{markers.length})<ChevronDown className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Show markers by activity</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setFilter({ runId, hidden: [] })}>Show all</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setFilter({ runId, hidden: markerTypes })}>Hide all</DropdownMenuItem>
              <DropdownMenuSeparator />
              {markerTypes.map(type => <DropdownMenuCheckboxItem key={type} checked={!hiddenTypes.includes(type)} onSelect={event => event.preventDefault()} onCheckedChange={checked => setFilter({ runId, hidden: checked ? hiddenTypes.filter(value => value !== type) : [...hiddenTypes, type] })}>
                <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: type === "latest_stop" ? "#0f172a" : markerAppearance(type).color }} />{type === "latest_stop" ? "Latest mapped stop" : type === "stationary_gps" ? "Stationary GPS" : eventLabel(type)} ({markers.filter(marker => marker.type === type).length})
              </DropdownMenuCheckboxItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {shownCount === 0 && markers.length > 0 && <p role="status" className="absolute bottom-16 left-3 rounded bg-background px-3 py-2 text-xs shadow">Event markers hidden. Use Marker types to show them.</p>}
        {selected !== null && <div className="pointer-events-none absolute left-3 bottom-6 rounded-md bg-background px-3 py-2 text-xs font-medium shadow-sm">{replay?.position ? "Replay position" : "Replay · Position unavailable"}</div>}
        </div>
        <RunTripTimeline model={model} selected={selected} onSelect={time => setSelection({ key, time })} loading={loading} error={error} onRetry={() => setRetry(value => value + 1)} limited={track?.source === "limited_history"} />
      </div> : <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">No mapped positions available.</div>}
      {!hasMap && <RunTripTimeline model={model} selected={selected} onSelect={time => setSelection({ key, time })} loading={loading} error={error} onRetry={() => setRetry(value => value + 1)} limited={track?.source === "limited_history"} />}
      <div className="flex flex-wrap gap-2">
        {(error || mapError || stale) && <Button variant="outline" onClick={() => setRetry(v => v + 1)}>Retry</Button>}
      </div>
  </div>
}

function vehicleIcon(): google.maps.Icon {
  return {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="white" stroke="#0f172a" stroke-width="2"/><g fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 23l3-8h14l3 8v9H14zM14 23h20M19 28h1m8 0h1M16 32v3m16-3v3"/></g></svg>')}`,
            scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 40),
          }
}
