"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"
import type { ShipmentStop } from "@/lib/types"
import { cn } from "@/lib/utils"

type LatLngLiteral = google.maps.LatLngLiteral

type StopPoint = ShipmentStop & {
  stopKey: string
  sequence: number
  position: LatLngLiteral | null
}

type MarkerEntry = {
  stopKey: string
  marker: google.maps.Marker
}

const fallbackCenter: LatLngLiteral = { lat: -33.9249, lng: 18.4241 }
const defaultZoom = 11
const singleStopZoom = 14

function toCoordinate(value: number | string | null | undefined) {
  const coordinate = Number(value)
  return Number.isNaN(coordinate) ? null : coordinate
}

function getStopKey(stop: ShipmentStop, fallbackIndex: number) {
  return stop.activity_id ?? `stop-${fallbackIndex}`
}

function getStopTimestamp(stop: ShipmentStop) {
  return stop.occurred_at ?? stop.entered_at ?? stop.created_at ?? ""
}

function getStopTimeValue(stop: ShipmentStop) {
  const value = getStopTimestamp(stop)
  const parsed = value ? new Date(value).getTime() : Number.NaN
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
}

function getStopPosition(stop: ShipmentStop): LatLngLiteral | null {
  const lat = toCoordinate(stop.latitude ?? stop.location?.latitude)
  const lng = toCoordinate(stop.longitude ?? stop.location?.longitude)
  if (lat === null || lng === null) return null
  return { lat, lng }
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}

function hasDisplayValue(value: unknown) {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  return true
}

function getVehicleLabel(make?: string | null, model?: string | null) {
  return [make, model].filter(hasDisplayValue).join(" ")
}

function formatEventLabel(value?: string | null) {
  if (!value) return "Shipment stop"
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (character) => character.toUpperCase())
}

function getStopTitle(stop: ShipmentStop) {
  return (
    stop.location?.name ??
    stop.location?.code ??
    stop.vehicle?.plate_number ??
    formatEventLabel(stop.event_type)
  )
}

function getStopSubtitle(stop: ShipmentStop) {
  return (
    stop.location?.full_address ??
    stop.location?.company ??
    stop.driver?.name ??
    stop.vehicle?.ref_code ??
    "No stop details"
  )
}

function getMarkerIcon(color: string) {
  const markerSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 52">
    <path d="M21 2C11.1 2 3 10.1 3 20c0 13.4 15.1 27.4 16.8 28.9.7.7 1.8.7 2.5 0C23.9 47.4 39 33.4 39 20 39 10.1 30.9 2 21 2z" fill="${color}" />
    <circle cx="21" cy="20" r="10.5" fill="#ffffff" />
  </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSvg)}`
}

function updateMarkerAppearance(
  entry: MarkerEntry,
  sequence: number,
  hovered: boolean,
  selected: boolean
) {
  const color = selected ? "#111827" : hovered ? "#0f766e" : "#2563eb"
  const size = selected ? 44 : hovered ? 40 : 36

  entry.marker.setIcon({
    url: getMarkerIcon(color),
    scaledSize: new google.maps.Size(size, size + 8),
    anchor: new google.maps.Point(size / 2, size + 7),
    labelOrigin: new google.maps.Point(size / 2, 18),
  })
  entry.marker.setLabel({
    text: String(sequence),
    color: "#111827",
    fontSize: hovered || selected ? "13px" : "12px",
    fontWeight: "700",
  })
  entry.marker.setZIndex(selected ? 1000 : hovered ? 500 : 1)
}

function StopDetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right font-medium break-words">
        {value}
      </span>
    </div>
  )
}

export function ShipmentStopsOverview({
  stops,
}: {
  stops?: ShipmentStop[] | null
}) {
  const mapRef = React.useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = React.useRef<google.maps.Map | null>(null)
  const markersRef = React.useRef<MarkerEntry[]>([])
  const polylineRef = React.useRef<google.maps.Polyline | null>(null)
  const [loadingMap, setLoadingMap] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [hoveredStopKey, setHoveredStopKey] = React.useState<string | null>(null)
  const [selectedStopKey, setSelectedStopKey] = React.useState<string | null>(null)

  const orderedStops = React.useMemo<StopPoint[]>(
    () =>
      [...(stops ?? [])]
        .sort((left, right) => getStopTimeValue(left) - getStopTimeValue(right))
        .map((stop, index) => ({
          ...stop,
          stopKey: getStopKey(stop, index),
          sequence: index + 1,
          position: getStopPosition(stop),
        })),
    [stops]
  )

  const mappedStops = React.useMemo(
    () => orderedStops.filter((stop) => Boolean(stop.position)),
    [orderedStops]
  )

  const selectedStop = React.useMemo(
    () =>
      orderedStops.find((stop) => stop.stopKey === selectedStopKey) ?? null,
    [orderedStops, selectedStopKey]
  )

  const stopDetailSections = React.useMemo(() => {
    if (!selectedStop) return null

    const overviewRows = [
      hasDisplayValue(selectedStop.event_type)
        ? {
            label: "Event type",
            value: formatEventLabel(selectedStop.event_type),
          }
        : null,
      hasDisplayValue(selectedStop.occurred_at)
        ? {
            label: "Occurred at",
            value: formatDateTime(selectedStop.occurred_at),
          }
        : null,
      hasDisplayValue(selectedStop.entered_at)
        ? {
            label: "Entered at",
            value: formatDateTime(selectedStop.entered_at),
          }
        : null,
      hasDisplayValue(selectedStop.exited_at)
        ? {
            label: "Exited at",
            value: formatDateTime(selectedStop.exited_at),
          }
        : null,
    ].filter(Boolean) as Array<{ label: string; value: React.ReactNode }>

    const vehicleLabel = getVehicleLabel(
      selectedStop.vehicle?.make,
      selectedStop.vehicle?.model
    )

    const vehicleRows = [
      hasDisplayValue(selectedStop.vehicle?.plate_number)
        ? {
            label: "Plate number",
            value: formatValue(selectedStop.vehicle?.plate_number),
          }
        : null,
      hasDisplayValue(selectedStop.vehicle?.ref_code)
        ? {
            label: "Reference code",
            value: formatValue(selectedStop.vehicle?.ref_code),
          }
        : null,
      hasDisplayValue(vehicleLabel)
        ? {
            label: "Vehicle",
            value: vehicleLabel,
          }
        : null,
      hasDisplayValue(selectedStop.driver?.name)
        ? {
            label: "Driver",
            value: formatValue(selectedStop.driver?.name),
          }
        : null,
      hasDisplayValue(selectedStop.driver?.email)
        ? {
            label: "Driver email",
            value: formatValue(selectedStop.driver?.email),
          }
        : null,
      hasDisplayValue(selectedStop.driver?.telephone)
        ? {
            label: "Driver phone",
            value: formatValue(selectedStop.driver?.telephone),
          }
        : null,
    ].filter(Boolean) as Array<{ label: string; value: React.ReactNode }>

    const locationRows = [
      hasDisplayValue(selectedStop.location?.type?.title)
        ? {
            label: "Location type",
            value: formatValue(selectedStop.location?.type?.title),
          }
        : null,
      hasDisplayValue(selectedStop.location?.name)
        ? {
            label: "Name",
            value: formatValue(selectedStop.location?.name),
          }
        : null,
      hasDisplayValue(selectedStop.location?.company)
        ? {
            label: "Company",
            value: formatValue(selectedStop.location?.company),
          }
        : null,
      hasDisplayValue(selectedStop.location?.code)
        ? {
            label: "Code",
            value: formatValue(selectedStop.location?.code),
          }
        : null,
      hasDisplayValue(selectedStop.location?.full_address)
        ? {
            label: "Address",
            value: formatValue(selectedStop.location?.full_address),
          }
        : null,
      hasDisplayValue(selectedStop.location?.city)
        ? {
            label: "City",
            value: formatValue(selectedStop.location?.city),
          }
        : null,
      hasDisplayValue(selectedStop.location?.province)
        ? {
            label: "Province",
            value: formatValue(selectedStop.location?.province),
          }
        : null,
      hasDisplayValue(selectedStop.location?.country)
        ? {
            label: "Country",
            value: formatValue(selectedStop.location?.country),
          }
        : null,
      hasDisplayValue(selectedStop.latitude)
        ? {
            label: "Latitude",
            value: formatValue(selectedStop.latitude),
          }
        : null,
      hasDisplayValue(selectedStop.longitude)
        ? {
            label: "Longitude",
            value: formatValue(selectedStop.longitude),
          }
        : null,
    ].filter(Boolean) as Array<{ label: string; value: React.ReactNode }>

    const shipmentRows = [
      hasDisplayValue(selectedStop.shipment?.merchant_order_ref)
        ? {
            label: "Merchant order ref",
            value: formatValue(selectedStop.shipment?.merchant_order_ref),
          }
        : null,
      hasDisplayValue(selectedStop.shipment?.status)
        ? {
            label: "Shipment status",
            value: formatValue(selectedStop.shipment?.status),
          }
        : null,
      hasDisplayValue(selectedStop.speed_kph)
        ? {
            label: "Speed (km/h)",
            value: formatValue(selectedStop.speed_kph),
          }
        : null,
      hasDisplayValue(selectedStop.speed_limit_kph)
        ? {
            label: "Speed limit (km/h)",
            value: formatValue(selectedStop.speed_limit_kph),
          }
        : null,
    ].filter(Boolean) as Array<{ label: string; value: React.ReactNode }>

    return {
      overviewRows,
      vehicleRows,
      locationRows,
      shipmentRows,
    }
  }, [selectedStop])

  React.useEffect(() => {
    if (!mapRef.current) return
    if (mappedStops.length === 0) {
      setLoadingMap(false)
      return
    }

    let cancelled = false
    setLoadingMap(true)
    setLoadError(null)

    loadGoogleMaps([])
      .then(() => {
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

        markersRef.current.forEach((entry) => entry.marker.setMap(null))
        markersRef.current = []
        polylineRef.current?.setMap(null)
        polylineRef.current = null

        markersRef.current = mappedStops.map((stop) => {
          const marker = new google.maps.Marker({
            map: mapInstanceRef.current!,
            position: stop.position!,
            title: `${stop.sequence}. ${getStopTitle(stop)}`,
          })

          marker.addListener("click", () => {
            setSelectedStopKey(stop.stopKey)
          })
          marker.addListener("mouseover", () => {
            setHoveredStopKey(stop.stopKey)
          })
          marker.addListener("mouseout", () => {
            setHoveredStopKey((current) =>
              current === stop.stopKey ? null : current
            )
          })

          const entry = { stopKey: stop.stopKey, marker }
          updateMarkerAppearance(entry, stop.sequence, false, false)
          return entry
        })

        if (mappedStops.length > 1) {
          polylineRef.current = new google.maps.Polyline({
            map: mapInstanceRef.current,
            path: mappedStops.map((stop) => stop.position!),
            geodesic: true,
            strokeColor: "#2563eb",
            strokeOpacity: 0.7,
            strokeWeight: 4,
          })
        }

        if (mappedStops.length === 1) {
          mapInstanceRef.current.setCenter(mappedStops[0].position!)
          mapInstanceRef.current.setZoom(singleStopZoom)
        } else {
          const bounds = new google.maps.LatLngBounds()
          mappedStops.forEach((stop) => bounds.extend(stop.position!))
          mapInstanceRef.current.fitBounds(bounds)
        }

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
      markersRef.current.forEach((entry) => entry.marker.setMap(null))
      markersRef.current = []
      polylineRef.current?.setMap(null)
      polylineRef.current = null
    }
  }, [mappedStops])

  React.useEffect(() => {
    markersRef.current.forEach((entry) => {
      const stop = orderedStops.find((item) => item.stopKey === entry.stopKey)
      if (!stop) return
      updateMarkerAppearance(
        entry,
        stop.sequence,
        entry.stopKey === hoveredStopKey,
        entry.stopKey === selectedStopKey
      )
    })
  }, [hoveredStopKey, orderedStops, selectedStopKey])

  React.useEffect(() => {
    if (!selectedStop || !selectedStop.position || !mapInstanceRef.current) return
    mapInstanceRef.current.panTo(selectedStop.position)
  }, [selectedStop])

  return (
    <>
      <div className="flex-1 flex">

        {loadError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}

        {mappedStops.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 text-sm text-muted-foreground">
            We can only show the shipment route map when stop coordinates are available.
          </div>
        ) : (
        <div ref={mapRef} className="min-h-[420px] rounded-lg flex-1 w-full bg-muted/30" />
        )}

        {loadingMap && mappedStops.length > 0 && !loadError ? (
          <div className="text-sm text-muted-foreground">Loading map…</div>
        ) : null}
      </div>

      <Card id="stops_card" className="h-full py-3">
        <CardContent className="space-y-4 px-3 text-sm">

          {orderedStops.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 p-6 bg-muted/30 text-muted-foreground">
              No stop activity is available for this shipment yet.
            </div>
          ) : (
            <div className="space-y-0">
              {orderedStops.map((stop, index) => {
                const active = stop.stopKey === selectedStopKey
                const hovered = stop.stopKey === hoveredStopKey
                return (
                  <button
                    key={stop.stopKey}
                    type="button"
                    className={cn(
                      "relative flex w-full items-start gap-4 rounded-xl border px-4 py-3 text-left transition-colors",
                      active
                        ? "z-10 border-foreground/20 bg-accent/60"
                        : hovered
                          ? "border-primary/30 bg-primary/5"
                          : "border-transparent hover:border-border/80 hover:bg-muted/30"
                    )}
                    onClick={() => setSelectedStopKey(stop.stopKey)}
                    onMouseEnter={() => setHoveredStopKey(stop.stopKey)}
                    onMouseLeave={() =>
                      setHoveredStopKey((current) =>
                        current === stop.stopKey ? null : current
                      )
                    }
                    onFocus={() => setHoveredStopKey(stop.stopKey)}
                    onBlur={() =>
                      setHoveredStopKey((current) =>
                        current === stop.stopKey ? null : current
                      )
                    }
                  >
                    <div className="relative flex min-w-8 flex-col items-center self-stretch">
                      {index > 0 ? (
                        <div className="absolute left-1/2 -top-px bottom-1/2 w-[2px] -translate-x-1/2 bg-border" />
                      ) : null}
                      {index < orderedStops.length - 1 ? (
                        <div className="absolute left-1/2 top-1/2 -bottom-px w-[2px] -translate-x-1/2 bg-border" />
                      ) : null}
                      <div
                        className={cn(
                          "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                          active
                            ? "border-foreground bg-foreground text-background"
                            : hovered
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background"
                        )}
                      >
                        {stop.sequence}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">{getStopTitle(stop)}</div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {formatEventLabel(stop.event_type)}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground">
                          {formatDateTime(getStopTimestamp(stop))}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getStopSubtitle(stop)}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Vehicle: {formatValue(stop.vehicle?.plate_number)}</span>
                        <span>Location Type: {formatValue(stop.location?.type?.title)}</span>
                        {stop.speed_kph && (
                          <span>Speed: {formatValue(stop.speed_kph)} km/h</span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedStop)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStopKey(null)
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {selectedStop ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  Stop {selectedStop.sequence}: {getStopTitle(selectedStop)}
                </DialogTitle>
                <DialogDescription>
                  {formatEventLabel(selectedStop.event_type)} at{" "}
                  {formatDateTime(getStopTimestamp(selectedStop))}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {stopDetailSections?.overviewRows.length ? (
                  <div className="space-y-3">
                    {stopDetailSections.overviewRows.map((row) => (
                      <StopDetailRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                      />
                    ))}
                  </div>
                ) : null}

                {stopDetailSections?.vehicleRows.length ? (
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase text-muted-foreground">
                      Vehicle and driver
                    </div>
                    {stopDetailSections.vehicleRows.map((row) => (
                      <StopDetailRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                      />
                    ))}
                  </div>
                ) : null}

                {stopDetailSections?.locationRows.length ? (
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase text-muted-foreground">
                      Location
                    </div>
                    {stopDetailSections.locationRows.map((row) => (
                      <StopDetailRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                      />
                    ))}
                  </div>
                ) : null}

                {stopDetailSections?.shipmentRows.length ? (
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase text-muted-foreground">
                      Shipment context
                    </div>
                    {stopDetailSections.shipmentRows.map((row) => (
                      <StopDetailRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                      />
                    ))}
                  </div>
                ) : null}

                {/* {selectedStop.metadata ? (
                  <div className="space-y-3">
                    <div className="text-xs uppercase text-muted-foreground">
                      Metadata
                    </div>
                    <pre className="overflow-x-auto rounded-lg border border-border/70 bg-muted/30 p-4 text-xs leading-5">
                      {JSON.stringify(selectedStop.metadata, null, 2)}
                    </pre>
                  </div>
                ) : null} */}
              </div>

              <DialogFooter showCloseButton />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
