"use client"

import * as React from "react"
import { ExternalLink } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"
import type { ShipmentSpeedingAlert } from "@/lib/api/reports"
import { cn } from "@/lib/utils"

type LatLngLiteral = google.maps.LatLngLiteral

type SpeedingAlertPoint = ShipmentSpeedingAlert & {
  alertKey: string
  sequence: number
  position: LatLngLiteral | null
}

type MarkerEntry = {
  alertKey: string
  marker: google.maps.Marker
  sequence: number
}

type ShipmentSpeedingAlertsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  alerts?: ShipmentSpeedingAlert[] | null
  shipmentNumber?: string | null
  vehiclePlateNumber?: string | null
}

const fallbackCenter: LatLngLiteral = { lat: -33.9249, lng: 18.4241 }
const defaultZoom = 11
const singleAlertZoom = 15

function getTimestampValue(value?: string | null) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp
}

function getPosition(alert: ShipmentSpeedingAlert): LatLngLiteral | null {
  const lat = alert.latitude
  const lng = alert.longitude
  if (
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    typeof lng !== "number" ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    return null
  }

  return { lat, lng }
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function formatSpeed(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-"
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} km/h`
}

function formatCoordinates(alert: ShipmentSpeedingAlert) {
  const position = getPosition(alert)
  if (!position) return "-"
  return `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
}

function markerIcon(selected: boolean) {
  const color = selected ? "#991B1B" : "#DC2626"
  const size = selected ? 44 : 38
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 52">
      <path d="M21 2C11.1 2 3 10.1 3 20c0 13.4 15.1 27.4 16.8 28.9.7.7 1.8.7 2.5 0C23.9 47.4 39 33.4 39 20 39 10.1 30.9 2 21 2z" fill="${color}" />
      <circle cx="21" cy="20" r="10.5" fill="#ffffff" />
    </svg>
  `

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size + 8),
    anchor: new google.maps.Point(size / 2, size + 7),
    labelOrigin: new google.maps.Point(size / 2, 18),
  }
}

function updateMarkerAppearance(entry: MarkerEntry, selected: boolean) {
  entry.marker.setIcon(markerIcon(selected))
  entry.marker.setLabel({
    text: String(entry.sequence),
    color: "#111827",
    fontSize: selected ? "13px" : "12px",
    fontWeight: "700",
  })
  entry.marker.setZIndex(selected ? 1000 : entry.sequence)
}

export function ShipmentSpeedingAlertsDialog({
  open,
  onOpenChange,
  alerts,
  shipmentNumber,
  vehiclePlateNumber,
}: ShipmentSpeedingAlertsDialogProps) {
  const mapRef = React.useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = React.useRef<google.maps.Map | null>(null)
  const markersRef = React.useRef<MarkerEntry[]>([])
  const [loadingMap, setLoadingMap] = React.useState(false)
  const [mapError, setMapError] = React.useState<string | null>(null)
  const [selectedAlertKey, setSelectedAlertKey] = React.useState<string | null>(null)

  const orderedAlerts = React.useMemo<SpeedingAlertPoint[]>(
    () =>
      [...(alerts ?? [])]
        .sort(
          (left, right) =>
            getTimestampValue(left.occurred_at) - getTimestampValue(right.occurred_at)
        )
        .map((alert, index) => ({
          ...alert,
          alertKey: alert.activity_id || `speeding-alert-${index}`,
          sequence: index + 1,
          position: getPosition(alert),
        })),
    [alerts]
  )

  const mappedAlerts = React.useMemo(
    () => orderedAlerts.filter((alert) => alert.position !== null),
    [orderedAlerts]
  )

  React.useEffect(() => {
    if (!open) {
      setSelectedAlertKey(null)
      return
    }

    setSelectedAlertKey(orderedAlerts[0]?.alertKey ?? null)
  }, [open, orderedAlerts])

  React.useEffect(() => {
    if (!open || !mapRef.current || mappedAlerts.length === 0) {
      setLoadingMap(false)
      return
    }

    let cancelled = false
    setLoadingMap(true)
    setMapError(null)

    loadGoogleMaps([])
      .then(() => {
        if (cancelled || !mapRef.current) return

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new google.maps.Map(mapRef.current, {
            center: fallbackCenter,
            zoom: defaultZoom,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
          })
        }

        markersRef.current.forEach((entry) => entry.marker.setMap(null))
        markersRef.current = mappedAlerts.map((alert) => {
          const marker = new google.maps.Marker({
            map: mapInstanceRef.current!,
            position: alert.position!,
            title: `${alert.sequence}. ${formatSpeed(alert.speed_kph)} at ${formatDateTime(alert.occurred_at)}`,
          })
          const entry = {
            alertKey: alert.alertKey,
            marker,
            sequence: alert.sequence,
          }
          marker.addListener("click", () => setSelectedAlertKey(alert.alertKey))
          updateMarkerAppearance(entry, alert.alertKey === selectedAlertKey)
          return entry
        })

        if (mappedAlerts.length === 1) {
          mapInstanceRef.current.setCenter(mappedAlerts[0].position!)
          mapInstanceRef.current.setZoom(singleAlertZoom)
        } else {
          const bounds = new google.maps.LatLngBounds()
          mappedAlerts.forEach((alert) => bounds.extend(alert.position!))
          mapInstanceRef.current.fitBounds(bounds)
        }

        setLoadingMap(false)
      })
      .catch((error) => {
        if (cancelled) return
        setMapError(
          error instanceof Error ? error.message : "Failed to load Google Maps."
        )
        setLoadingMap(false)
      })

    return () => {
      cancelled = true
      markersRef.current.forEach((entry) => entry.marker.setMap(null))
      markersRef.current = []
      mapInstanceRef.current = null
    }
  }, [mappedAlerts, open])

  React.useEffect(() => {
    markersRef.current.forEach((entry) => {
      updateMarkerAppearance(entry, entry.alertKey === selectedAlertKey)
    })

    if (!selectedAlertKey || !mapInstanceRef.current) return
    const marker = markersRef.current.find(
      (entry) => entry.alertKey === selectedAlertKey
    )?.marker
    const position = marker?.getPosition()
    if (position) mapInstanceRef.current.panTo(position)
  }, [selectedAlertKey])

  const context = [
    shipmentNumber ? `Shipment ${shipmentNumber}` : null,
    vehiclePlateNumber ? `Vehicle ${vehiclePlateNumber}` : null,
  ].filter(Boolean).join(" · ")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-5 pr-14">
          <DialogTitle>Speeding alerts</DialogTitle>
          <DialogDescription>
            {context ? `${context}. ` : ""}
            {orderedAlerts.length} {orderedAlerts.length === 1 ? "alert" : "alerts"} during transit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto p-6">
          <div className="relative h-[360px] overflow-hidden rounded-lg border bg-muted/30">
            {mappedAlerts.length > 0 ? (
              <div ref={mapRef} className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                No coordinates are available for these speeding alerts.
              </div>
            )}
            {loadingMap ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground backdrop-blur-sm">
                Loading map…
              </div>
            ) : null}
            {mapError ? (
              <div className="absolute inset-x-4 bottom-4 rounded-md border border-destructive/30 bg-background/95 p-3 text-sm text-destructive shadow-sm">
                {mapError.includes("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")
                  ? "Google Maps is not configured for this environment."
                  : mapError}
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="border-b bg-muted/30 px-4 py-3">
              <h3 className="text-sm font-semibold">Alert details</h3>
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-14">#</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Speed</TableHead>
                    <TableHead>Limit</TableHead>
                    <TableHead>Over limit</TableHead>
                    <TableHead>Coordinates</TableHead>
                    <TableHead className="w-20">Map</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderedAlerts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No speeding alerts were found for this shipment.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orderedAlerts.map((alert) => {
                      const selected = alert.alertKey === selectedAlertKey
                      const mapsUrl = alert.position
                        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${alert.position.lat},${alert.position.lng}`)}`
                        : null

                      return (
                        <TableRow
                          key={alert.alertKey}
                          data-state={selected ? "selected" : undefined}
                          className={cn(alert.position && "cursor-pointer")}
                          tabIndex={alert.position ? 0 : undefined}
                          onClick={() => {
                            if (alert.position) setSelectedAlertKey(alert.alertKey)
                          }}
                          onKeyDown={(event) => {
                            if (
                              alert.position &&
                              (event.key === "Enter" || event.key === " ")
                            ) {
                              event.preventDefault()
                              setSelectedAlertKey(alert.alertKey)
                            }
                          }}
                        >
                          <TableCell className="font-medium">{alert.sequence}</TableCell>
                          <TableCell>{formatDateTime(alert.occurred_at)}</TableCell>
                          <TableCell>{formatSpeed(alert.speed_kph)}</TableCell>
                          <TableCell>{formatSpeed(alert.speed_limit_kph)}</TableCell>
                          <TableCell className="font-medium text-red-600">
                            {formatSpeed(alert.over_limit_kph)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {formatCoordinates(alert)}
                          </TableCell>
                          <TableCell>
                            {mapsUrl ? (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Open speeding alert ${alert.sequence} in Google Maps`}
                                className="inline-flex rounded-sm text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <ExternalLink className="size-4" aria-hidden="true" />
                              </a>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
