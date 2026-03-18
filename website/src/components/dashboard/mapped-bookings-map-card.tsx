"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"
import { cn } from "@/lib/utils"
import { isApiErrorResponse } from "@/lib/api/client"
import {
  getMappedBookings,
  type MappedBookingsReport,
} from "@/lib/api/reports"

type LatLngLiteral = google.maps.LatLngLiteral

type MarkerEntry = {
  bookingId: string
  shipmentId?: string
  marker: google.maps.Marker
  color: string
}

const fallbackCenter: LatLngLiteral = { lat: -26.2041, lng: 28.0473 }
const defaultZoom = 10
const selectedMarkerZoom = 14

const STATUS_CONFIG: Record<
  string,
  { color: string; label: string }
> = {
  booked: { color: "#f59e0b", label: "Booked" },
  in_transit: { color: "#06b6d4", label: "In transit" },
  delivered: { color: "#10b981", label: "Delivered" },
  cancelled: { color: "#78716c", label: "Cancelled" },
  failed: { color: "#ef4444", label: "Failed" },
}

const EMPTY_REPORT: MappedBookingsReport = {
  data: [],
  meta: {
    counts_by_status: {},
    total: 0,
  },
}

function getStatusConfig(status?: string | null) {
  if (!status) {
    return { color: "#64748b", label: "Unknown" }
  }

  return STATUS_CONFIG[status] ?? {
    color: "#64748b",
    label: status.replace(/_/g, " ").replace(/^./, (value) => value.toUpperCase()),
  }
}

function getMarkerIcon(color: string, selected: boolean) {
  const size = selected ? 23 : 16
  const markerSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 54">
    <path d="M22 3C11.5 3 3 11.5 3 22c0 14.4 16.1 28.8 17.9 30.4a1.7 1.7 0 0 0 2.2 0C24.9 50.8 41 36.4 41 22 41 11.5 32.5 3 22 3z" fill="${color}" />
    <circle cx="22" cy="22" r="10" fill="#ffffff" />
  </svg>
  `

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSvg)}`,
    scaledSize: new google.maps.Size(size, size + 8),
    anchor: new google.maps.Point(size / 2, size + 7),
  }
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return "Unknown update time"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

export function MappedBookingsMapCard({
  accessToken,
  merchantId,
  selectedShipmentId,
  onSelectShipment,
}: {
  accessToken?: string
  merchantId?: string | null
  selectedShipmentId?: string | null
  onSelectShipment?: (shipmentId: string | null) => void
}) {
  const mapRef = React.useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = React.useRef<google.maps.Map | null>(null)
  const markersRef = React.useRef<MarkerEntry[]>([])
  const [searchValue, setSearchValue] = React.useState("")
  const deferredSearch = React.useDeferredValue(searchValue)
  const [loading, setLoading] = React.useState(false)
  const [report, setReport] = React.useState<MappedBookingsReport>(EMPTY_REPORT)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [mapError, setMapError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!merchantId) {
      setReport(EMPTY_REPORT)
      setLoadError(null)
      return
    }

    let active = true

    const loadReport = async () => {
      setLoading(true)
      setLoadError(null)

      const response = await getMappedBookings(
        {
          merchant_id: merchantId,
          search: deferredSearch.trim() || undefined,
        },
        accessToken
      )

      if (!active) return

      if (isApiErrorResponse(response)) {
        setLoadError(response.message)
        setReport(EMPTY_REPORT)
        toast.error(response.message || "Failed to load mapped bookings.")
        setLoading(false)
        return
      }

      setReport(response)
      setLoading(false)
    }

    void loadReport()

    return () => {
      active = false
    }
  }, [accessToken, deferredSearch, merchantId])

  React.useEffect(() => {
    if (!mapRef.current) return

    let cancelled = false

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

        setMapError(null)
      })
      .catch((error) => {
        if (cancelled) return
        setMapError(
          error instanceof Error ? error.message : "Failed to load Google Maps."
        )
      })

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!mapInstanceRef.current) return

    markersRef.current.forEach((entry) => entry.marker.setMap(null))
    markersRef.current = []

    const points = report.data.filter(
      (item) =>
        typeof item.latitude === "number" && typeof item.longitude === "number"
    )

    markersRef.current = points.map((item) => {
      const config = getStatusConfig(item.status)
      const marker = new google.maps.Marker({
        map: mapInstanceRef.current!,
        position: {
          lat: item.latitude!,
          lng: item.longitude!,
        },
        title: item.merchant_order_ref ?? item.booking_id,
      })

      const entry: MarkerEntry = {
        bookingId: item.booking_id,
        shipmentId: item.shipment_id ?? undefined,
        marker,
        color: config.color,
      }

      marker.setIcon(getMarkerIcon(config.color, item.shipment_id === selectedShipmentId))

      marker.addListener("click", () => {
        if (!item.shipment_id) {
          toast.error("This booking is not linked to a shipment.")
          return
        }
        onSelectShipment?.(item.shipment_id)
      })

      const details = [
        `<div style="min-width:180px">`,
        `<div style="font-weight:600">${item.merchant_order_ref ?? item.booking_id}</div>`,
        `<div style="margin-top:4px">Status: ${getStatusConfig(item.status).label}</div>`,
        item.vehicle_label ? `<div>Vehicle: ${item.vehicle_label}</div>` : "",
        item.driver_name ? `<div>Driver: ${item.driver_name}</div>` : "",
        `<div style="margin-top:4px;color:#6b7280">${formatUpdatedAt(item.updated_at)}</div>`,
        `</div>`,
      ].join("")
      const infoWindow = new google.maps.InfoWindow({ content: details })

      marker.addListener("mouseover", () => {
        infoWindow.open({ anchor: marker, map: mapInstanceRef.current })
      })
      marker.addListener("mouseout", () => {
        infoWindow.close()
      })

      return entry
    })

    if (points.length === 1) {
      mapInstanceRef.current.setCenter({
        lat: points[0].latitude!,
        lng: points[0].longitude!,
      })
      mapInstanceRef.current.setZoom(selectedMarkerZoom)
      return
    }

    if (points.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      points.forEach((point) => {
        bounds.extend({ lat: point.latitude!, lng: point.longitude! })
      })
      mapInstanceRef.current.fitBounds(bounds)
      return
    }

    mapInstanceRef.current.setCenter(fallbackCenter)
    mapInstanceRef.current.setZoom(defaultZoom)

    return () => {
      markersRef.current.forEach((entry) => entry.marker.setMap(null))
      markersRef.current = []
    }
  }, [onSelectShipment, report.data, selectedShipmentId])

  React.useEffect(() => {
    markersRef.current.forEach((entry) => {
      entry.marker.setIcon(
        getMarkerIcon(entry.color, entry.shipmentId === selectedShipmentId)
      )

      if (
        selectedShipmentId &&
        entry.shipmentId === selectedShipmentId &&
        mapInstanceRef.current
      ) {
        const position = entry.marker.getPosition()
        if (position) {
          mapInstanceRef.current.panTo(position)
          if ((mapInstanceRef.current.getZoom() ?? defaultZoom) < selectedMarkerZoom) {
            mapInstanceRef.current.setZoom(selectedMarkerZoom)
          }
        }
      }
    })
  }, [selectedShipmentId])

  const countsByStatus = report.meta?.counts_by_status ?? {}
  const summaryRows = Object.entries(countsByStatus)
    .sort(([left], [right]) => {
      if (left === "in_transit") return -1
      if (right === "in_transit") return 1
      return left.localeCompare(right)
    })
    .map(([status, count]) => ({
      status,
      count,
      ...getStatusConfig(status),
    }))

  return (
    <Card className="p-0!">
      <CardHeader className="gap-3 p-3 pb-0">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Live bookings map</CardTitle>
          </div>
          <div className="flex items-center gap-2 md:max-w-md w-1/3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search..."
                className="pl-9"
              />
            </div>
            {searchValue ? (
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setSearchValue("")}
                aria-label="Clear search"
              >
                <X />
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0!">
        {!merchantId ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
            Select a merchant to view live bookings on the map.
          </div>
        ) : mapError ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-destructive">
            {mapError}
          </div>
        ) : (
          <div className="p-3 pt-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {loadError ? <span className="text-destructive">{loadError}</span> : null}
            </div>

            <div className="relative overflow-hidden rounded-xl bg-muted/20">
              <div ref={mapRef} className="h-[330px] w-full" />
              <div className="absolute p-1 px-3 rounded-full top-1 right-1 z-50 bg-white text-xs text-black">
                {loading ? "Loading map data..." : `${report.meta?.total ?? 0} mapped bookings`}
              </div>
              <div className="pointer-events-none absolute  bottom-0 p-3">
                <div className="pointer-events-auto rounded-xl  bg-background/95 p-3 shadow-lg backdrop-blur">
                  {summaryRows.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {summaryRows.map((item) => (
                        <div
                          key={item.status}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
                          )}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span>
                            {item.label} - {item.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      No active bookings matched the current filters.
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  )
}
