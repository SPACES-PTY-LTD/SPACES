"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"

type LatLngLiteral = google.maps.LatLngLiteral

const pointZoom = 15

function toCoordinate(value: number | string | null | undefined) {
  const coordinate = Number(value)
  return Number.isNaN(coordinate) ? null : coordinate
}

export function VehicleLocationMap({
  latitude,
  longitude,
  label,
}: {
  latitude?: number | string | null
  longitude?: number | string | null
  label?: string | null
}) {
  const mapRef = React.useRef<HTMLDivElement | null>(null)
  const mapInstance = React.useRef<google.maps.Map | null>(null)
  const markerRef = React.useRef<google.maps.Marker | null>(null)
  const [loadingMap, setLoadingMap] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const lat = toCoordinate(latitude)
  const lng = toCoordinate(longitude)

  React.useEffect(() => {
    if (!mapRef.current || lat === null || lng === null) return

    let cancelled = false

    loadGoogleMaps([])
      .then(() => {
        if (cancelled || !mapRef.current) return

        const center = { lat, lng }

        if (!mapInstance.current) {
          mapInstance.current = new google.maps.Map(mapRef.current, {
            center,
            zoom: pointZoom,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          })
        } else {
          mapInstance.current.setCenter(center)
          mapInstance.current.setZoom(pointZoom)
        }

        if (markerRef.current) {
          markerRef.current.setMap(null)
          markerRef.current = null
        }

        markerRef.current = new google.maps.Marker({
          map: mapInstance.current,
          position: center,
          title: label ?? "Vehicle location",
        })

        setLoadError(null)
        setLoadingMap(false)
      })
      .catch((error) => {
        if (cancelled) return
        console.error("Failed to load Google Maps", error)
        setLoadError(
          error instanceof Error ? error.message : "Failed to load Google Maps."
        )
        setLoadingMap(false)
      })

    return () => {
      cancelled = true
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
    }
  }, [label, lat, lng])

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <div className="text-xs text-muted-foreground">Last known location</div>
          <div className="font-medium">{label?.trim() || "Vehicle map"}</div>
        </div>
        {loadError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}
        <div className="overflow-hidden rounded-lg border border-border">
          <div ref={mapRef} className="h-[360px] w-full bg-muted/30" />
        </div>
        {loadingMap && !loadError ? (
          <div className="text-sm text-muted-foreground">Loading map…</div>
        ) : null}
      </CardContent>
    </Card>
  )
}
