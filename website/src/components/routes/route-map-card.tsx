"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"
import type { RouteStopLocation } from "@/lib/types"

type RouteMapStop = {
  stopId: string
  sequence: number
  name: string
  address: string
  latitude?: number | null
  longitude?: number | null
  location?: RouteStopLocation | null
}

type RouteMapCardProps = {
  stops: RouteMapStop[]
}

type GoogleRouteOption = {
  label: string
  distanceMeters: number
  durationSeconds: number
}

const fallbackCenter: google.maps.LatLngLiteral = { lat: -33.9249, lng: 18.4241 }
const defaultZoom = 11

function getRouteLabel(index: number) {
  if (index < 26) {
    return `Route ${String.fromCharCode(65 + index)}`
  }
  return `Route ${index + 1}`
}

function getStopMarkerIconUrl() {
  const markerSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 44">
    <path d="M18 1C10.3 1 4 7.3 4 15c0 9.6 11.1 22.3 13 24.3a1.4 1.4 0 0 0 2 0C20.9 37.3 32 24.6 32 15 32 7.3 25.7 1 18 1z" fill="#000000"/>
    <circle cx="18" cy="15" r="8.2" fill="#111111"/>
  </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSvg)}`
}

function summarizeRoute(route: google.maps.DirectionsRoute): GoogleRouteOption {
  const totals = (route.legs ?? []).reduce(
    (acc, leg) => {
      acc.distanceMeters += leg.distance?.value ?? 0
      acc.durationSeconds += leg.duration?.value ?? 0
      return acc
    },
    { distanceMeters: 0, durationSeconds: 0 }
  )

  return {
    label: "",
    distanceMeters: totals.distanceMeters,
    durationSeconds: totals.durationSeconds,
  }
}

function formatFieldLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (value) => value.toUpperCase())
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatFieldValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (Array.isArray(value) || typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return null
    }
  }
  return null
}

function buildLocationInfoHtml(stop: RouteMapStop) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Stop", value: String(stop.sequence) },
    { label: "Name", value: stop.name },
    { label: "Address", value: stop.address },
  ]

  const locationEntries = Object.entries(stop.location ?? {})
  for (const [key, rawValue] of locationEntries) {
    const formattedValue = formatFieldValue(rawValue)
    if (!formattedValue) continue
    rows.push({
      label: formatFieldLabel(key),
      value: formattedValue,
    })
  }

  const detailRows = rows
    .map(
      (row) =>
        `<div style="margin-top:4px;"><strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.value)}</div>`
    )
    .join("")

  return `<div style="min-width:220px;max-width:320px;font-size:12px;line-height:1.4;"><div style="font-size:13px;font-weight:600;">${escapeHtml(
    stop.name
  )}</div>${detailRows}</div>`
}

export function RouteMapCard({ stops }: RouteMapCardProps) {
  const mapRef = React.useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = React.useRef<google.maps.Map | null>(null)
  const markersRef = React.useRef<google.maps.Marker[]>([])
  const infoWindowRef = React.useRef<google.maps.InfoWindow | null>(null)
  const primaryRendererRef = React.useRef<google.maps.DirectionsRenderer | null>(null)
  const primaryDirectionsRef = React.useRef<google.maps.DirectionsResult | null>(null)
  const directionsRenderersRef = React.useRef<google.maps.DirectionsRenderer[]>([])
  const [loadingMap, setLoadingMap] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [googleEstimate, setGoogleEstimate] = React.useState<{
    distanceMeters: number
    durationSeconds: number
  } | null>(null)
  const [routeOptions, setRouteOptions] = React.useState<GoogleRouteOption[]>([])
  const [selectedRouteIndex, setSelectedRouteIndex] = React.useState(0)
  const [limitedRouteOptions, setLimitedRouteOptions] = React.useState(false)

  const points = React.useMemo(
    () =>
      stops
        .map((stop) => {
          const latitude = Number(stop.latitude)
          const longitude = Number(stop.longitude)
          if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null
          return {
            ...stop,
            position: { lat: latitude, lng: longitude } satisfies google.maps.LatLngLiteral,
          }
        })
        .filter((stop): stop is RouteMapStop & { position: google.maps.LatLngLiteral } => Boolean(stop)),
    [stops]
  )

  React.useEffect(() => {
    if (!mapRef.current) return
    if (points.length === 0) {
      setLoadingMap(false)
      return
    }

    let cancelled = false
    setLoadingMap(true)
    setLoadError(null)
    setGoogleEstimate(null)
    setRouteOptions([])
    setSelectedRouteIndex(0)
    setLimitedRouteOptions(false)

    loadGoogleMaps([])
      .then(async () => {
        if (cancelled || !mapRef.current) return

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new google.maps.Map(mapRef.current, {
            center: fallbackCenter,
            zoom: defaultZoom,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          })
        }
        if (!infoWindowRef.current) {
          infoWindowRef.current = new google.maps.InfoWindow()
        }

        markersRef.current.forEach((marker) => marker.setMap(null))
        markersRef.current = []
        primaryRendererRef.current?.setMap(null)
        primaryRendererRef.current = null
        primaryDirectionsRef.current = null
        directionsRenderersRef.current.forEach((renderer) => renderer.setMap(null))
        directionsRenderersRef.current = []

        markersRef.current = points.map((point) => {
          const marker = new google.maps.Marker({
            map: mapInstanceRef.current!,
            position: point.position,
            title: `Stop ${point.sequence}: ${point.name}`,
            icon: {
              url: getStopMarkerIconUrl(),
              scaledSize: new google.maps.Size(36, 44),
              anchor: new google.maps.Point(18, 42),
              labelOrigin: new google.maps.Point(18, 15),
            },
            label: {
              text: String(point.sequence),
              color: "#ffffff",
              fontWeight: "700",
            },
          })
          marker.addListener("click", () => {
            if (!infoWindowRef.current) return
            infoWindowRef.current.setContent(buildLocationInfoHtml(point))
            infoWindowRef.current.open({
              map: mapInstanceRef.current,
              anchor: marker,
            })
          })
          return marker
        })

        if (points.length >= 2) {
          const directionsService = new google.maps.DirectionsService()
          if (points.length <= 25) {
            const response = await directionsService.route({
              origin: points[0].position,
              destination: points[points.length - 1].position,
              travelMode: google.maps.TravelMode.DRIVING,
              optimizeWaypoints: false,
              provideRouteAlternatives: true,
              waypoints: points.slice(1, -1).map((point) => ({
                location: point.position,
                stopover: true,
              })),
            })

            if (cancelled) return

            const renderer = new google.maps.DirectionsRenderer({
              map: mapInstanceRef.current,
              suppressMarkers: true,
              preserveViewport: false,
              polylineOptions: {
                strokeColor: "#2563eb",
                strokeOpacity: 0.85,
                strokeWeight: 5,
              },
            })
            renderer.setDirections(response)
            renderer.setRouteIndex(0)
            primaryRendererRef.current = renderer
            primaryDirectionsRef.current = response

            const options = (response.routes ?? []).map((route, index) => ({
              ...summarizeRoute(route),
              label: getRouteLabel(index),
            }))
            setRouteOptions(options)
            setSelectedRouteIndex(0)

            if (options[0]) {
              setGoogleEstimate({
                distanceMeters: options[0].distanceMeters,
                durationSeconds: options[0].durationSeconds,
              })
            }
          } else {
            const maxPointsPerRequest = 25
            const pointBatches: Array<typeof points> = []
            let totalDistanceMeters = 0
            let totalDurationSeconds = 0

            for (
              let startIndex = 0;
              startIndex < points.length - 1;
              startIndex += maxPointsPerRequest - 1
            ) {
              const endIndex = Math.min(
                startIndex + maxPointsPerRequest - 1,
                points.length - 1
              )
              pointBatches.push(points.slice(startIndex, endIndex + 1))
              if (endIndex === points.length - 1) break
            }

            for (const batch of pointBatches) {
              if (cancelled) return
              const response = await directionsService.route({
                origin: batch[0].position,
                destination: batch[batch.length - 1].position,
                travelMode: google.maps.TravelMode.DRIVING,
                optimizeWaypoints: false,
                provideRouteAlternatives: false,
                waypoints: batch.slice(1, -1).map((point) => ({
                  location: point.position,
                  stopover: true,
                })),
              })

              const renderer = new google.maps.DirectionsRenderer({
                map: mapInstanceRef.current,
                suppressMarkers: true,
                preserveViewport: true,
                polylineOptions: {
                  strokeColor: "#2563eb",
                  strokeOpacity: 0.85,
                  strokeWeight: 5,
                },
              })
              renderer.setDirections(response)
              directionsRenderersRef.current.push(renderer)

              const routeLegs = response.routes?.[0]?.legs ?? []
              for (const leg of routeLegs) {
                totalDistanceMeters += leg.distance?.value ?? 0
                totalDurationSeconds += leg.duration?.value ?? 0
              }
            }

            if (!cancelled) {
              setRouteOptions([
                {
                  label: getRouteLabel(0),
                  distanceMeters: totalDistanceMeters,
                  durationSeconds: totalDurationSeconds,
                },
              ])
              setGoogleEstimate({
                distanceMeters: totalDistanceMeters,
                durationSeconds: totalDurationSeconds,
              })
              setLimitedRouteOptions(true)
            }
          }
        } else if (points.length === 1) {
          setRouteOptions([
            {
              label: getRouteLabel(0),
              distanceMeters: 0,
              durationSeconds: 0,
            },
          ])
          setGoogleEstimate({
            distanceMeters: 0,
            durationSeconds: 0,
          })
        } else {
          setRouteOptions([])
          setGoogleEstimate(null)
        }

        if (!primaryRendererRef.current) {
          const bounds = new google.maps.LatLngBounds()
          points.forEach((point) => bounds.extend(point.position))
          mapInstanceRef.current.fitBounds(bounds)

          if (points.length === 1) {
            mapInstanceRef.current.setCenter(points[0].position)
            mapInstanceRef.current.setZoom(14)
          }
        }

        if (points.length === 1 && mapInstanceRef.current) {
          mapInstanceRef.current.setCenter(points[0].position)
          mapInstanceRef.current.setZoom(14)
        }

        setLoadingMap(false)
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : "Failed to load Google Maps.")
        setLoadingMap(false)
      })

    return () => {
      cancelled = true
      infoWindowRef.current?.close()
      primaryRendererRef.current?.setMap(null)
      primaryRendererRef.current = null
      primaryDirectionsRef.current = null
      directionsRenderersRef.current.forEach((renderer) => renderer.setMap(null))
      directionsRenderersRef.current = []
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current = []
    }
  }, [points])

  React.useEffect(() => {
    const renderer = primaryRendererRef.current
    const directions = primaryDirectionsRef.current
    if (!renderer || !directions) return
    if (selectedRouteIndex < 0 || selectedRouteIndex >= directions.routes.length) return

    renderer.setRouteIndex(selectedRouteIndex)
    const selectedRoute = routeOptions[selectedRouteIndex]
    if (selectedRoute) {
      setGoogleEstimate({
        distanceMeters: selectedRoute.distanceMeters,
        durationSeconds: selectedRoute.durationSeconds,
      })
    }
  }, [routeOptions, selectedRouteIndex])

  const missingCoordinatesCount = stops.length - points.length
  const googleDistanceKm =
    googleEstimate ? (googleEstimate.distanceMeters / 1000).toFixed(1) : null
  const googleDurationMin =
    googleEstimate ? Math.round(googleEstimate.durationSeconds / 60) : null

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm font-medium">Route map</div>
          <div className="text-xs text-muted-foreground">
            Stop markers and route path based on stop sequence.
          </div>
        </div>

        {points.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No stop coordinates are available for this route.
          </div>
        ) : (
          <div className="relative h-[360px] overflow-hidden rounded-md border border-border/60">
            <div ref={mapRef} className="h-full w-full" />
            <div className="absolute left-3 top-3 z-[1] w-[240px] max-w-[calc(100%-1.5rem)] rounded-md border border-border/70 bg-background/95 px-3 py-2 shadow-sm backdrop-blur-sm">
              <div className="text-[11px] text-muted-foreground">Google routes</div>
              <div className="mt-1.5 space-y-1.5">
                {routeOptions.length > 0 ? (
                  routeOptions.map((option, index) => (
                    <label
                      key={option.label}
                      className="flex cursor-pointer items-start gap-2 rounded-sm p-1 hover:bg-muted/60"
                    >
                      <input
                        type="radio"
                        name="google-route-option"
                        className="mt-0.5 h-3.5 w-3.5 accent-primary"
                        checked={selectedRouteIndex === index}
                        onChange={() => setSelectedRouteIndex(index)}
                      />
                      <span className="block">
                        <span className="block text-xs font-medium">{option.label}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {(option.distanceMeters / 1000).toFixed(1)} km •{" "}
                          {Math.round(option.durationSeconds / 60)} min
                        </span>
                      </span>
                    </label>
                  ))
                ) : (
                  <div className="text-[11px] text-muted-foreground">No Google routes available.</div>
                )}
              </div>
              {limitedRouteOptions ? (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Alternatives are limited for routes with many stops.
                </div>
              ) : null}
              <div className="mt-2 border-t border-border/60 pt-2">
                <div className="text-[11px] text-muted-foreground">Selected estimate</div>
                <div className="text-xs font-medium">
                  {googleDistanceKm !== null ? `${googleDistanceKm} km` : "-"} •{" "}
                  {googleDurationMin !== null ? `${googleDurationMin} min` : "-"}
                </div>
              </div>
            </div>
            {loadingMap ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
                Loading map...
              </div>
            ) : null}
            {loadError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/90 px-4 text-center text-sm text-destructive">
                {loadError}
              </div>
            ) : null}
          </div>
        )}

        {missingCoordinatesCount > 0 ? (
          <div className="text-xs text-muted-foreground">
            {missingCoordinatesCount} stop{missingCoordinatesCount === 1 ? "" : "s"} omitted due to missing
            coordinates.
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
