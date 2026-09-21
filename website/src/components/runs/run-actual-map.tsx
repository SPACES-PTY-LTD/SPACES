"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"
import { getRunTrack, type RunTrack } from "@/lib/api/runs"
import { isApiErrorResponse } from "@/lib/api/client"
import type { ShipmentStop } from "@/lib/types"
import { ChevronDown, Filter } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { buildRunMapMarkers, eventLabel, markerDetails } from "./run-map-markers"

type Props = { runId: string; accessToken?: string | null; stops: ShipmentStop[]; activities?: ShipmentStop[] }

export function RunActualMap({ runId, accessToken, stops, activities }: Props) {
  const [mapElement, setMapElement] = React.useState<HTMLDivElement | null>(null)
  const [visible, setVisible] = React.useState(false)
  const container = React.useRef<HTMLDivElement>(null)
  const [routeWindow, setWindow] = React.useState<{ runId: string; before?: string }>({ runId })
  const before = routeWindow.runId === runId ? routeWindow.before : undefined
  const setBefore = (value: string | undefined) => setWindow({ runId, before: value })
  const [retry, setRetry] = React.useState(0)
  const [result, setResult] = React.useState<{ key: string; track: RunTrack } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [mapError, setMapError] = React.useState<string | null>(null)
  const key = `${accessToken}:${runId}:${before ?? ""}`
  const track = result?.key === key ? result.track : null
  const markers = React.useMemo(() => buildRunMapMarkers(stops, track, activities), [stops, track, activities])
  const [filter, setFilter] = React.useState<{ runId: string; hidden: string[] }>({ runId, hidden: [] })
  const hiddenTypes = React.useMemo(() => filter.runId === runId ? filter.hidden : [], [filter, runId])
  const markerTypes = React.useMemo(() => [...new Set(markers.map(marker => marker.type))], [markers])
  const shownCount = markers.filter(marker => !hiddenTypes.includes(marker.type)).length
  const markerHandles = React.useRef<{ marker: google.maps.Marker; type: string }[]>([])
  const infoWindow = React.useRef<google.maps.InfoWindow | null>(null)
  const hiddenRef = React.useRef(hiddenTypes)
  React.useEffect(() => {
    hiddenRef.current = hiddenTypes
    markerHandles.current.forEach(({ marker, type }) => marker.setVisible(!hiddenTypes.includes(type)))
    infoWindow.current?.close()
  }, [hiddenTypes])
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
      try {
        const response = await getRunTrack(runId, accessToken, before)
        if (cancelled) return
        if (isApiErrorResponse(response)) { setError(response.message); return }
        active = response.active
        setResult({ key, track: response }); setError(null)
      } catch { if (!cancelled) setError("Recorded route could not be refreshed.") }
      finally { pending = false }
    }
    void refresh()
    const timer = window.setInterval(() => { if (active && !before) void refresh() }, 60000)
    const onVisible = () => { if (active && !before) void refresh() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible) }
  }, [runId, accessToken, before, key, visible, retry])
  React.useEffect(() => {
    if (!mapElement || !hasMap) return
    let cancelled = false
    const listeners: google.maps.MapsEventListener[] = []
    const overlays: (google.maps.Marker | google.maps.Polyline)[] = []
    loadGoogleMaps([]).then(() => {
      if (cancelled) return
      setMapError(null)
      const map = new google.maps.Map(mapElement, { center: { lat: 0, lng: 0 }, zoom: 12, mapTypeControl: false, streetViewControl: false, fullscreenControlOptions: { position: google.maps.ControlPosition.LEFT_TOP } })
      const details = new google.maps.InfoWindow({ maxWidth: 350 })
      infoWindow.current = details
      const bounds = new google.maps.LatLngBounds()
      track?.segments.forEach(segment => {
        const path = segment.map(p => ({ lat: p.latitude, lng: p.longitude }))
        path.forEach(p => bounds.extend(p))
        if (path.length > 1) overlays.push(new google.maps.Polyline({ map, path, strokeColor: "#2563eb", strokeWeight: 4 }))
      })
      markerHandles.current = markers.map(item => {
        bounds.extend(item.position)
        const marker = new google.maps.Marker({ map, position: item.position, label: item.label, title: item.title, visible: !hiddenRef.current.includes(item.type) })
        overlays.push(marker)
        listeners.push(marker.addListener("click", () => {
          // Include overlapping events/visits so a pin cannot conceal another stop's details.
          const atPosition = markers.filter(other => other.position.lat === item.position.lat && other.position.lng === item.position.lng && !hiddenRef.current.includes(other.type))
          details.setContent(markerDetails(atPosition))
          details.open({ map, anchor: marker })
        }))
        return { marker, type: item.type }
      })
      if (!bounds.isEmpty()) map.fitBounds(bounds, 48)
    }).catch(() => { if (!cancelled) setMapError("Map unavailable. Try again.") })
    return () => { cancelled = true; listeners.forEach(listener => listener.remove()); infoWindow.current?.close(); infoWindow.current = null; markerHandles.current = []; overlays.forEach(overlay => overlay.setMap(null)) }
  }, [mapElement, track, markers, hasMap, retry])
  const stale = track?.active && track.latest_observed_at && Date.now() - Date.parse(track.latest_observed_at) > 300000
  return <div ref={container}><Card>
    <CardHeader><CardTitle>{track?.source === "limited_history" ? "Limited historical data" : "Recorded GPS"}</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-xs text-muted-foreground">Blue lines show the driver’s recorded GPS route. Numbered pins show run stops. Click a pin for activity, duration and location details. Times include your local time zone. Lines break where tracking is missing.</p>
      {track?.coverage.partial && <p className="text-sm text-muted-foreground">Partial route coverage{track.coverage.from ? ` · ${new Date(track.coverage.from).toLocaleString()} – ${new Date(track.coverage.to!).toLocaleString()}` : " · older activity events only"}.</p>}
      {(error || stale) && <p role="status" className="text-sm text-amber-700">{error ? `${track ? "Showing previous data. " : ""}${error}` : "Tracking is stale; showing the last recorded route."}</p>}
      {mapError && <p role="alert" className="text-sm text-destructive">{mapError}</p>}
      {!hasTrack && <p role="status" className="text-sm text-muted-foreground">{track?.status === "disabled" ? "Recorded route display is not enabled." : track ? "No GPS history recorded for this run. The route taken is unavailable." : error ? "Route unavailable." : "Loading recorded route…"}</p>}
      {hasMap ? <div className="relative">
        <div ref={setMapElement} className="h-[420px] w-full rounded-lg" aria-label="Run stops and recorded GPS route map" />
        <div className="absolute right-3 top-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" className="bg-background shadow-sm"><Filter className="size-4" />Marker types ({shownCount}/{markers.length})<ChevronDown className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Show markers by activity</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setFilter({ runId, hidden: [] })}>Show all</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setFilter({ runId, hidden: markerTypes })}>Hide all</DropdownMenuItem>
              <DropdownMenuSeparator />
              {markerTypes.map(type => <DropdownMenuCheckboxItem key={type} checked={!hiddenTypes.includes(type)} onSelect={event => event.preventDefault()} onCheckedChange={checked => setFilter({ runId, hidden: checked ? hiddenTypes.filter(value => value !== type) : [...hiddenTypes, type] })}>
                {type === "stationary_gps" ? "Stationary GPS" : eventLabel(type)} ({markers.filter(marker => marker.type === type).length})
              </DropdownMenuCheckboxItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {shownCount === 0 && markers.length > 0 && <p role="status" className="absolute bottom-6 left-3 rounded bg-background px-3 py-2 text-xs shadow">All markers hidden. Use Marker types to show them.</p>}
      </div> : <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">No mapped positions available.</div>}
      <div className="flex flex-wrap gap-2">
        {(error || mapError || stale) && <Button variant="outline" onClick={() => setRetry(v => v + 1)}>Retry</Button>}
        {track?.coverage.next_before && <Button variant="outline" onClick={() => setBefore(track.coverage.next_before!)}>Earlier route</Button>}
        {before && <Button variant="outline" onClick={() => setBefore(undefined)}>Latest route</Button>}
      </div>
    </CardContent>
  </Card></div>
}
