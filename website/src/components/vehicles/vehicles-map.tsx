"use client"

import * as React from "react"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"
import { MarkerClusterer } from "@googlemaps/markerclusterer"
import type { Vehicle } from "@/lib/types"
import { Button } from "../ui/button"
import { Edit, X } from "lucide-react"

type LatLngLiteral = google.maps.LatLngLiteral

type MarkerEntry = {
  key: string
  marker: google.maps.Marker
  color: string
}

type VehiclesMapProps = {
  vehicles: Vehicle[]
  selectedVehicleKey?: string | null
  selectedVehicle?: Vehicle | null
  onSelectVehicle?: (vehicleKey: string) => void
  onClearSelection?: () => void
}

const fallbackCenter: LatLngLiteral = { lat: -33.9249, lng: 18.4241 }
const defaultZoom = 12
const singleMarkerZoom = 14
const selectedMarkerZoom = 16

function getColorSeed(vehicle: Vehicle) {
  return (
    vehicle.vehicle_id ??
    vehicle.vehicle_uuid ??
    vehicle.driver_vehicle_id ??
    vehicle.plate_number ??
    vehicle.ref_code ??
    "vehicle"
  )
}

function getVehicleKey(vehicle: Vehicle, fallbackIndex: number) {
  return (
    vehicle.vehicle_id ??
    vehicle.vehicle_uuid ??
    vehicle.driver_vehicle_id ??
    vehicle.plate_number ??
    vehicle.ref_code ??
    `vehicle-${fallbackIndex}`
  )
}

function getVehicleColor(seed: string) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 78% 42%)`
}

function getVehicleMarkerIconUrl(color: string) {
  const vehicleMarkerSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <path d="M24 2C14.1 2 6 10.1 6 20c0 12.4 14.9 24.9 17.1 26.7a1.5 1.5 0 0 0 1.8 0C27.1 44.9 42 32.4 42 20 42 10.1 33.9 2 24 2z" fill="${color}" />
    <circle cx="24" cy="20" r="12" fill="#ffffff" />
    <rect x="14" y="16" width="12" height="8" rx="2" fill="${color}" />
    <path d="M26 17h5l3 3v4h-8z" fill="${color}" />
    <circle cx="19" cy="25" r="2.3" fill="#111827" />
    <circle cx="31" cy="25" r="2.3" fill="#111827" />
  </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(vehicleMarkerSvg)}`
}

function updateMarkerAppearance(entry: MarkerEntry, isSelected: boolean) {
  entry.marker.setIcon({
    url: getVehicleMarkerIconUrl(entry.color),
    scaledSize: new google.maps.Size(isSelected ? 48 : 38, isSelected ? 48 : 38),
    anchor: new google.maps.Point(isSelected ? 24 : 19, isSelected ? 47 : 37),
  })
  entry.marker.setZIndex(isSelected ? 999 : 1)
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function getVehiclePoints(vehicles: Vehicle[]) {
  return vehicles
    .map((vehicle, index) => {
      const latitude = Number(vehicle.last_location_address?.latitude)
      const longitude = Number(vehicle.last_location_address?.longitude)
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null
      return {
        key: getVehicleKey(vehicle, index),
        vehicle,
        position: { lat: latitude, lng: longitude } satisfies LatLngLiteral,
      }
    })
    .filter(
      (
        point
      ): point is { key: string; vehicle: Vehicle; position: LatLngLiteral } =>
        Boolean(point)
    )
}

export function VehiclesMap({
  vehicles,
  selectedVehicleKey,
  selectedVehicle,
  onSelectVehicle,
  onClearSelection,
}: VehiclesMapProps) {
  const mapRef = React.useRef<HTMLDivElement | null>(null)
  const mapInstance = React.useRef<google.maps.Map | null>(null)
  const markersRef = React.useRef<MarkerEntry[]>([])
  const markerClusterRef = React.useRef<MarkerClusterer | null>(null)
  const bounceTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loadingMap, setLoadingMap] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!mapRef.current) return
    let cancelled = false

    loadGoogleMaps([])
      .then(() => {
        if (cancelled || !mapRef.current) return
        if (!mapInstance.current) {
          mapInstance.current = new google.maps.Map(mapRef.current, {
            center: fallbackCenter,
            zoom: defaultZoom,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          })
        }

        const points = getVehiclePoints(vehicles)
        markerClusterRef.current?.clearMarkers()
        markerClusterRef.current = null
        markersRef.current.forEach((entry) => entry.marker.setMap(null))

        markersRef.current = points.map((point) => {
          const markerColor = getVehicleColor(getColorSeed(point.vehicle))
          const marker = new google.maps.Marker({
            position: point.position,
            title:
              point.vehicle.plate_number ?? point.vehicle.ref_code ?? "Vehicle",
          })

          marker.addListener("click", () => {
            onSelectVehicle?.(point.key)
          })

          const entry: MarkerEntry = { key: point.key, marker, color: markerColor }
          updateMarkerAppearance(entry, false)
          return entry
        })

        if (mapInstance.current && markersRef.current.length > 0) {
          markerClusterRef.current = new MarkerClusterer({
            map: mapInstance.current,
            markers: markersRef.current.map((entry) => entry.marker),
          })
        }

        if (points.length === 1) {
          mapInstance.current.setCenter(points[0].position)
          mapInstance.current.setZoom(singleMarkerZoom)
        } else if (points.length > 1) {
          const bounds = new google.maps.LatLngBounds()
          points.forEach((point) => bounds.extend(point.position))
          mapInstance.current.fitBounds(bounds)
        } else {
          mapInstance.current.setCenter(fallbackCenter)
          mapInstance.current.setZoom(defaultZoom)
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
      markerClusterRef.current?.clearMarkers()
      markerClusterRef.current = null
      markersRef.current.forEach((entry) => entry.marker.setMap(null))
      markersRef.current = []
    }
  }, [onSelectVehicle, vehicles])

  React.useEffect(() => {
    markersRef.current.forEach((entry) => {
      updateMarkerAppearance(entry, entry.key === selectedVehicleKey)
    })

    if (bounceTimeoutRef.current) {
      clearTimeout(bounceTimeoutRef.current)
      bounceTimeoutRef.current = null
    }

    markersRef.current.forEach((entry) => {
      entry.marker.setAnimation(null)
    })

    if (!selectedVehicleKey) return
    const selectedEntry = markersRef.current.find(
      (entry) => entry.key === selectedVehicleKey
    )
    if (!selectedEntry) return

    selectedEntry.marker.setAnimation(google.maps.Animation.BOUNCE)
    bounceTimeoutRef.current = setTimeout(() => {
      selectedEntry.marker.setAnimation(null)
      bounceTimeoutRef.current = null
    }, 1400)
  }, [selectedVehicleKey])

  React.useEffect(() => {
    return () => {
      if (bounceTimeoutRef.current) {
        clearTimeout(bounceTimeoutRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    if (!selectedVehicleKey || !mapInstance.current) return

    const selectedMarker = markersRef.current.find(
      (entry) => entry.key === selectedVehicleKey
    )?.marker
    const position = selectedMarker?.getPosition()
    if (!selectedMarker || !position) return

    mapInstance.current.panTo(position)
    if ((mapInstance.current.getZoom() ?? defaultZoom) < selectedMarkerZoom) {
      mapInstance.current.setZoom(selectedMarkerZoom)
    }
  }, [selectedVehicleKey])

  if (loadError?.includes("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")) {
    return (
      <div className="rounded-md border border-dashed text-sm text-muted-foreground">
        Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to enable the vehicles map.
      </div>
    )
  }

  if (!vehicles.length) {
    return (
      <div className="rounded-md border border-dashed text-sm text-muted-foreground">
        No vehicles available to display on the map.
      </div>
    )
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-secondary">
      {selectedVehicle ? (
        <div
          className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-md p-3 shadow w-md max-h-[calc(100%-2rem)] overflow-y-auto"
          id="selected-vehicle-info"
        >
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium">Selected Vehicle</div>
            <div className="flex items-center">
              <Button
                variant="outline"
                className="mr-3 px-10"
                size="sm"
                onClick={onClearSelection}
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                size="icon"
                onClick={onClearSelection}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 space-y-1 text-xs">
            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Type</span>
              <span>{formatValue(selectedVehicle.type?.name)}</span>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Odometer</span>
              <span>{formatValue(selectedVehicle.odometer)}</span>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Make</span>
              <span>{formatValue(selectedVehicle.make)}</span>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Model</span>
              <span>{formatValue(selectedVehicle.model)}</span>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Color</span>
              <span>{formatValue(selectedVehicle.color)}</span>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Registration Number</span>
              <span>{formatValue(selectedVehicle.plate_number)}</span>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">VIN Number</span>
              <span>{formatValue(selectedVehicle.vin_number)}</span>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Engine Number</span>
              <span>{formatValue(selectedVehicle.engine_number)}</span>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Reference Code</span>
              <span>{formatValue(selectedVehicle.ref_code)}</span>
            </div>
            
            {/* <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Integration ID</span>
              <span>{formatValue(selectedVehicle.intergration_id)}</span>
            </div> */}
            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Is Active</span>
              <span>{formatValue(selectedVehicle.is_active)}</span>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Status</span>
              <span>{formatValue(selectedVehicle.status)}</span>
            </div>

            <div className="pt-2 font-medium text-foreground">Last location address</div>
            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Full Address</span>
              <span>
                {formatValue(selectedVehicle.last_location_address?.full_address)}
              </span>
            </div>

            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Location Updated At</span>
              <span>{formatDateTime(selectedVehicle.location_updated_at)}</span>
            </div>
          
            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Latitude</span>
              <span>
                {formatValue(selectedVehicle.last_location_address?.latitude)}
              </span>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-x-2">
              <span className="text-muted-foreground">Longitude</span>
              <span>
                {formatValue(selectedVehicle.last_location_address?.longitude)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
      {loadingMap ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Loading map...
        </div>
      ) : null}
      <div className="absolute inset-0" ref={mapRef} />
    </div>
  )
}
