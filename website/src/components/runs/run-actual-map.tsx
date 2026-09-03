"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"
import type { RunTrackPoint, ShipmentStop } from "@/lib/types"

type Props = {
  trackPoints: RunTrackPoint[]
  stops: ShipmentStop[]
}

function validPosition(latitude?: number | null, longitude?: number | null) {
  if (typeof latitude !== "number" || typeof longitude !== "number") return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { lat: latitude, lng: longitude }
}

function stopPosition(stop: ShipmentStop) {
  return validPosition(
    stop.latitude ?? stop.location?.latitude,
    stop.longitude ?? stop.location?.longitude
  )
}

function stopTitle(stop: ShipmentStop, index: number) {
  return (
    stop.location?.name ??
    stop.location?.company ??
    stop.shipment?.merchant_order_ref ??
    `${(stop.event_type ?? "stop").replaceAll("_", " ")} ${index + 1}`
  )
}

function simplifiedPoints(points: RunTrackPoint[]) {
  if (points.length <= 1000) return points
  const interval = Math.ceil(points.length / 998)
  return [points[0], ...points.slice(1, -1).filter((_, index) => index % interval === 0), points.at(-1)!]
}

export function RunActualMap({ trackPoints, stops }: Props) {
  const [mapElement, setMapElement] = React.useState<HTMLDivElement | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(trackPoints.length > 0)

  React.useEffect(() => {
    if (!mapElement || trackPoints.length === 0) {
      setLoading(false)
      return
    }

    let cancelled = false
    let markers: google.maps.Marker[] = []
    let polyline: google.maps.Polyline | null = null

    loadGoogleMaps([])
      .then(() => {
        if (cancelled) return
        const path = simplifiedPoints(trackPoints)
          .map((point) => validPosition(point.latitude, point.longitude))
          .filter((point): point is google.maps.LatLngLiteral => point !== null)

        if (path.length === 0) {
          setLoading(false)
          return
        }

        const map = new google.maps.Map(mapElement, {
          center: path[0],
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
        })
        const bounds = new google.maps.LatLngBounds()
        path.forEach((point) => bounds.extend(point))
        polyline = new google.maps.Polyline({
          map,
          path,
          strokeColor: "#2563eb",
          strokeOpacity: 0.9,
          strokeWeight: 4,
        })

        const markerData = [
          { position: path[0], label: "S", title: "Run start" },
          ...(path.length > 1 ? [{ position: path[path.length - 1], label: "E", title: "Run end" }] : []),
          ...stops.flatMap((stop, index) => {
            const position = stopPosition(stop)
            return position ? [{ position, label: String(index + 1), title: stopTitle(stop, index) }] : []
          }),
        ]

        markers = markerData.map(({ position, label, title }) => {
          bounds.extend(position)
          return new google.maps.Marker({ map, position, label, title })
        })
        map.fitBounds(bounds, 48)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError("The map could not be loaded. Check the Google Maps configuration and try again.")
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      markers.forEach((marker) => marker.setMap(null))
      polyline?.setMap(null)
    }
  }, [mapElement, stops, trackPoints])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actual route and stops</CardTitle>
      </CardHeader>
      <CardContent>
        {trackPoints.length === 0 ? (
          <div className="flex h-72 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No GPS coordinates were recorded for this run.
          </div>
        ) : error ? (
          <div className="flex h-72 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
            {error}
          </div>
        ) : (
          <div className="relative">
            <div ref={setMapElement} className="h-[420px] w-full rounded-lg" aria-label="Actual run route map" />
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80 text-sm text-muted-foreground">
                Loading map…
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
