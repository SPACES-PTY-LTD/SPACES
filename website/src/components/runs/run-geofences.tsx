"use client"

import * as React from "react"
import { Switch } from "@/components/ui/switch"
import { getLocation } from "@/lib/api/locations"
import { isApiErrorResponse } from "@/lib/api/client"
import type { Location } from "@/lib/types"
import { loadGeofenceLocations } from "./run-geofence-data"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"

const geofenceColors = ["#7c3aed", "#0d9488", "#ea580c", "#db2777", "#0284c7", "#65a30d", "#b45309", "#4f46e5", "#dc2626", "#0891b2", "#a21caf", "#059669"]

export function RunGeofences({ map, locationIds, accessToken, refreshVersion = 0 }: {
  map: google.maps.Map | null
  locationIds: string[]
  accessToken?: string | null
  refreshVersion?: number
}) {
  const [enabled, setEnabled] = React.useState(false)
  const [locations, setLocations] = React.useState<Location[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [retry, setRetry] = React.useState(0)
  const [geometryReady, setGeometryReady] = React.useState(false)
  const cache = React.useRef(new Map<string, Location>())
  const cacheVersion = React.useRef(refreshVersion)
  const labelId = React.useId()
  const idsKey = JSON.stringify(locationIds)

  React.useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const ids: string[] = JSON.parse(idsKey)
    const load = async () => {
      if (cacheVersion.current !== refreshVersion) {
        cache.current.clear()
        cacheVersion.current = refreshVersion
      }
      setLoading(true)
      setError(false)
      try {
        await loadGoogleMaps(["geometry"])
      } catch {
        if (!cancelled) { setError(true); setLoading(false) }
        return
      }
      if (cancelled) return
      setGeometryReady(true)
      const result = await loadGeofenceLocations(ids, cache.current, async id => {
        const location = await getLocation(id, accessToken)
        if (isApiErrorResponse(location)) throw new Error(location.message)
        return location
      }, () => cancelled)
      if (cancelled) return
      setLocations(result.locations)
      setError(result.failed)
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [enabled, idsKey, accessToken, retry, refreshVersion])

  React.useEffect(() => {
    if (!enabled || !map || !geometryReady) return
    // Assign from the complete, sorted ID list so partial loads cannot shift colours.
    const ids: string[] = JSON.parse(idsKey)
    const colors = new Map([...new Set(ids)].sort().map((id, index) => [id, geofenceColors[index % geofenceColors.length]]))
    const overlays: (google.maps.Polygon | google.maps.Circle)[] = []
    const hitAreas: { overlay: google.maps.Polygon | google.maps.Circle; location: Location }[] = []
    const listeners: google.maps.MapsEventListener[] = []
    const label = document.createElement("div")
    label.className = "pointer-events-none absolute max-w-60 whitespace-pre-line rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-md"
    label.setAttribute("role", "tooltip")
    label.style.transform = "translate(-50%, calc(-100% - 12px))"
    label.style.display = "none"
    let position: google.maps.LatLng | null = null
    const tooltip = new google.maps.OverlayView()
    tooltip.onAdd = () => { tooltip.getPanes()?.floatPane.appendChild(label) }
    tooltip.draw = () => {
      if (!position) return
      const point = tooltip.getProjection()?.fromLatLngToDivPixel(position)
      if (!point) return
      label.style.left = `${point.x}px`
      label.style.top = `${point.y}px`
    }
    tooltip.onRemove = () => label.remove()
    tooltip.setMap(map)
    const hideTooltip = () => { position = null; label.style.display = "none" }
    listeners.push(map.addListener("dragstart", hideTooltip), map.addListener("zoom_changed", hideTooltip))
    const addOverlay = (overlay: google.maps.Polygon | google.maps.Circle, location: Location) => {
      overlays.push(overlay)
      hitAreas.push({ overlay, location })
      const showTooltip = (event: google.maps.MapMouseEvent) => {
        if (!event.latLng) return
        position = event.latLng
        // The top shape receives mouse events, but every containing location
        // must be inspectable, including polygons hidden beneath radius circles.
        const matches = new Map<string, Location>()
        for (const area of hitAreas) {
          const shape = area.overlay
          const contains = shape instanceof google.maps.Polygon
            ? google.maps.geometry.poly.containsLocation(event.latLng, shape) || google.maps.geometry.poly.isLocationOnEdge(event.latLng, shape)
            : Boolean(shape.getCenter() && google.maps.geometry.spherical.computeDistanceBetween(event.latLng, shape.getCenter()!) <= shape.getRadius())
          if (contains) matches.set(area.location.location_id, area.location)
        }
        // Keep the event's location on the stroke itself, even at pixel edges.
        matches.set(location.location_id, location)
        label.textContent = [...matches.values()].map(match => match.name || match.company || match.code || "Unnamed geofence").join("\n")
        label.style.display = "block"
        tooltip.draw()
      }
      listeners.push(overlay.addListener("mouseover", showTooltip), overlay.addListener("mousemove", showTooltip), overlay.addListener("mouseout", hideTooltip))
    }
    for (const location of locations) {
      const color = colors.get(location.location_id) ?? geofenceColors[0]
      const options = { map, clickable: true, strokeColor: color, strokeOpacity: 0.8, strokeWeight: 2, fillColor: color, fillOpacity: 0.12, zIndex: -1 }
      const points = location.polygon_bounds
      if (points && points.length >= 3 && points.every(p => p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180)) {
        addOverlay(new google.maps.Polygon({ ...options, paths: points.map(([lat, lng]) => ({ lat, lng })) }), location)
      }
      // Lifecycle detection also uses a radius around the saved location centre.
      const lat = location.latitude, lng = location.longitude
      const radius = Number(location.metadata?.geofence_radius_meters ?? 150)
      if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180 && Number.isFinite(radius) && radius > 0) {
        addOverlay(new google.maps.Circle({ ...options, center: { lat: Number(lat), lng: Number(lng) }, radius }), location)
      }
    }
    return () => {
      listeners.forEach(listener => listener.remove())
      tooltip.setMap(null)
      overlays.forEach(overlay => overlay.setMap(null))
    }
  }, [enabled, map, locations, idsKey, geometryReady])

  return <div className="max-w-60 rounded-md border bg-background px-3 py-2 shadow-sm">
    <div className="flex items-center gap-2">
      <Switch id={labelId} checked={enabled} onCheckedChange={setEnabled} />
      <label htmlFor={labelId} className="cursor-pointer text-sm font-medium">Geofences</label>
    </div>
    {enabled && <div role="status" className="mt-1 text-xs text-muted-foreground">
      {loading ? "Loading geofences…" : error ? <>Some geofences could not load. <button className="underline" onClick={() => setRetry(value => value + 1)}>Retry</button></> : locationIds.length === 0 ? "No linked locations." : null}
    </div>}
  </div>
}
