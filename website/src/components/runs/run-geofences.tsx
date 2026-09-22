"use client"

import * as React from "react"
import { Switch } from "@/components/ui/switch"
import { getLocation } from "@/lib/api/locations"
import { isApiErrorResponse } from "@/lib/api/client"
import type { Location } from "@/lib/types"
import { loadGeofenceLocations } from "./run-geofence-data"

export function RunGeofences({ map, locationIds, accessToken }: {
  map: google.maps.Map | null
  locationIds: string[]
  accessToken?: string | null
}) {
  const [enabled, setEnabled] = React.useState(false)
  const [locations, setLocations] = React.useState<Location[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [retry, setRetry] = React.useState(0)
  const cache = React.useRef(new Map<string, Location>())
  const labelId = React.useId()
  const idsKey = JSON.stringify(locationIds)

  React.useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const ids: string[] = JSON.parse(idsKey)
    const load = async () => {
      setLoading(true)
      setError(false)
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
  }, [enabled, idsKey, accessToken, retry])

  React.useEffect(() => {
    if (!enabled || !map) return
    const overlays: (google.maps.Polygon | google.maps.Circle)[] = []
    for (const location of locations) {
      const options = { map, clickable: false, strokeColor: "#7c3aed", strokeOpacity: 0.8, strokeWeight: 2, fillColor: "#8b5cf6", fillOpacity: 0.1, zIndex: -1 }
      const points = location.polygon_bounds
      if (points && points.length >= 3 && points.every(p => p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180)) {
        overlays.push(new google.maps.Polygon({ ...options, paths: points.map(([lat, lng]) => ({ lat, lng })) }))
      }
      // Lifecycle detection also uses a radius around the saved location centre.
      const lat = location.latitude, lng = location.longitude
      const radius = Number(location.metadata?.geofence_radius_meters ?? 150)
      if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180 && Number.isFinite(radius) && radius > 0) {
        overlays.push(new google.maps.Circle({ ...options, center: { lat: Number(lat), lng: Number(lng) }, radius }))
      }
    }
    return () => overlays.forEach(overlay => overlay.setMap(null))
  }, [enabled, map, locations])

  return <div className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-md border bg-background px-3 py-2 shadow-sm">
    <div className="flex items-center gap-2">
      <Switch id={labelId} checked={enabled} onCheckedChange={setEnabled} />
      <label htmlFor={labelId} className="cursor-pointer text-sm font-medium">Geofences</label>
    </div>
    {enabled && <div role="status" className="mt-1 text-xs text-muted-foreground">
      {loading ? "Loading geofences…" : error ? <>Some geofences could not load. <button className="underline" onClick={() => setRetry(value => value + 1)}>Retry</button></> : locationIds.length === 0 ? "No linked locations." : null}
    </div>}
  </div>
}
