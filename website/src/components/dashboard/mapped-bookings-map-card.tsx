"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"
import { isApiErrorResponse } from "@/lib/api/client"
import { listAllVehiclesCheck } from "@/lib/api/vehicle-activities"
import type { VehicleActivity } from "@/lib/types"

type LatLngLiteral = google.maps.LatLngLiteral

type MarkerEntry = {
  vehicleId: string
  shipmentId?: string
  marker: google.maps.Marker
}

const fallbackCenter: LatLngLiteral = { lat: -26.2041, lng: 28.0473 }
const defaultZoom = 10
const selectedMarkerZoom = 14

const IN_TRANSIT_COLOR = "#06b6d4"

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
  const [vehicles, setVehicles] = React.useState<VehicleActivity[]>([])
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [mapError, setMapError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!merchantId) {
      setVehicles([])
      setLoadError(null)
      return
    }

    let active = true

    const loadReport = async () => {
      setLoading(true)
      setLoadError(null)

      const response = await listAllVehiclesCheck(accessToken, {
        merchant_id: merchantId,
        plate_number: deferredSearch.trim() || undefined,
        page: 1,
        per_page: 500,
      })

      if (!active) return

      if (isApiErrorResponse(response)) {
        setLoadError(response.message)
        setVehicles([])
        toast.error(response.message || "Failed to load vehicles in transit.")
        setLoading(false)
        return
      }

      setVehicles(
        (response.data ?? []).filter(
          (activity) => activity.monitoring?.status === "in_transit"
        )
      )
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

    const points = vehicles.filter(
      (item) =>
        typeof item.latitude === "number" && typeof item.longitude === "number"
    )

    markersRef.current = points.map((item) => {
      const vehicleId = item.vehicle?.vehicle_id ?? item.vehicle_id ?? item.activity_id ?? "unknown-vehicle"
      const plateNumber = item.vehicle?.plate_number ?? item.vehicle?.ref_code ?? vehicleId
      const shipmentId = item.shipment?.shipment_id
      const marker = new google.maps.Marker({
        map: mapInstanceRef.current!,
        position: {
          lat: item.latitude!,
          lng: item.longitude!,
        },
        title: plateNumber,
      })

      const entry: MarkerEntry = {
        vehicleId,
        shipmentId,
        marker,
      }

      marker.setIcon(getMarkerIcon(IN_TRANSIT_COLOR, shipmentId === selectedShipmentId))

      marker.addListener("click", () => {
        if (shipmentId) onSelectShipment?.(shipmentId)
      })

      const details = [
        `<div style="min-width:180px">`,
        `<div style="font-weight:600">${plateNumber}</div>`,
        `<div style="margin-top:4px">Status: In transit</div>`,
        item.driver?.name ? `<div>Driver: ${item.driver.name}</div>` : "",
        item.shipment?.merchant_order_ref ? `<div>Shipment: ${item.shipment.merchant_order_ref}</div>` : "",
        `<div style="margin-top:4px;color:#6b7280">${formatUpdatedAt(item.occurred_at ?? item.created_at)}</div>`,
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
  }, [onSelectShipment, selectedShipmentId, vehicles])

  React.useEffect(() => {
    markersRef.current.forEach((entry) => {
      entry.marker.setIcon(
        getMarkerIcon(IN_TRANSIT_COLOR, entry.shipmentId === selectedShipmentId)
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

  const mappedVehicleCount = vehicles.filter(
    (vehicle) => typeof vehicle.latitude === "number" && typeof vehicle.longitude === "number"
  ).length

  return (
    <Card className="p-0!">
      <CardHeader className="gap-3 p-3 pb-0">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Vehicles in transit</CardTitle>
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
            Select a merchant to view vehicles in transit on the map.
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
                {loading ? "Loading map data..." : `${mappedVehicleCount} of ${vehicles.length} vehicles mapped`}
              </div>
              <div className="pointer-events-none absolute  bottom-0 p-3">
                <div className="pointer-events-auto rounded-xl  bg-background/95 p-3 shadow-lg backdrop-blur">
                  {vehicles.length > 0 ? (
                    <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: IN_TRANSIT_COLOR }} />
                      <span>In transit - {vehicles.length}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      No vehicles in transit matched the current filters.
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
