"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"
import { getRunTrack, type RunTrack } from "@/lib/api/runs"
import { isApiErrorResponse } from "@/lib/api/client"
import type { ShipmentStop } from "@/lib/types"

type Props = { runId: string; accessToken?: string | null; stops: ShipmentStop[] }

export function RunActualMap({ runId, accessToken, stops }: Props) {
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
    if (!mapElement || !track?.segments.length) return
    let cancelled = false
    const overlays: (google.maps.Marker | google.maps.Polyline)[] = []
    loadGoogleMaps([]).then(() => {
      if (cancelled) return
      setMapError(null)
      const map = new google.maps.Map(mapElement, { center: { lat: 0, lng: 0 }, zoom: 12, mapTypeControl: false, streetViewControl: false })
      const bounds = new google.maps.LatLngBounds()
      track.segments.forEach(segment => {
        const path = segment.map(p => ({ lat: p.latitude, lng: p.longitude }))
        path.forEach(p => bounds.extend(p))
        if (path.length > 1) overlays.push(new google.maps.Polyline({ map, path, strokeColor: "#2563eb", strokeWeight: 4 }))
        else if (path[0]) overlays.push(new google.maps.Marker({ map, position: path[0], title: "Recorded position" }))
      })
      stops.forEach((stop, index) => {
        const lat = stop.latitude ?? stop.location?.latitude, lng = stop.longitude ?? stop.location?.longitude
        if (lat == null || lng == null) return
        overlays.push(new google.maps.Marker({ map, position: { lat, lng }, label: String(index + 1), title: stop.location?.name || "Run stop" }))
      })
      track.stops.forEach(stop => overlays.push(new google.maps.Marker({ map, position: { lat: stop.latitude, lng: stop.longitude }, title: `Stationary · ${new Date(stop.first_seen_at).toLocaleString()} – ${new Date(stop.last_seen_at).toLocaleString()}` })))
      if (!bounds.isEmpty()) map.fitBounds(bounds, 48)
    }).catch(() => { if (!cancelled) setMapError("Map unavailable. Try again.") })
    return () => { cancelled = true; overlays.forEach(overlay => overlay.setMap(null)) }
  }, [mapElement, track, stops, retry])
  const stale = track?.active && track.latest_observed_at && Date.now() - Date.parse(track.latest_observed_at) > 300000
  return <div ref={container}><Card>
    <CardHeader><CardTitle>{track?.source === "limited_history" ? "Limited historical data" : "Recorded GPS"}</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-xs text-muted-foreground">Recorded observations, not road directions. Lines break where tracking is missing.</p>
      {track?.coverage.partial && <p className="text-sm text-muted-foreground">Partial route coverage{track.coverage.from ? ` · ${new Date(track.coverage.from).toLocaleString()} – ${new Date(track.coverage.to!).toLocaleString()}` : " · older activity events only"}.</p>}
      {(error || stale) && <p role="status" className="text-sm text-amber-700">{error ? `${track ? "Showing previous data. " : ""}${error}` : "Tracking is stale; showing the last recorded route."}</p>}
      {mapError && <p role="alert" className="text-sm text-destructive">{mapError}</p>}
      {track?.segments.length ? <div ref={setMapElement} className="h-[420px] w-full rounded-lg" aria-label="Recorded GPS route map" /> : <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">{track?.status === "disabled" ? "Recorded route display is not enabled." : track ? "No GPS history recorded for this run." : error ? "Route unavailable." : "Loading recorded route…"}</div>}
      <div className="flex flex-wrap gap-2">
        {(error || mapError || stale) && <Button variant="outline" onClick={() => setRetry(v => v + 1)}>Retry</Button>}
        {track?.coverage.next_before && <Button variant="outline" onClick={() => setBefore(track.coverage.next_before!)}>Earlier route</Button>}
        {before && <Button variant="outline" onClick={() => setBefore(undefined)}>Latest route</Button>}
      </div>
    </CardContent>
  </Card></div>
}
