"use client"

import * as React from "react"
import { toast } from "sonner"
import { updateLocation } from "@/lib/api/locations"
import { isApiErrorResponse } from "@/lib/api/client"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"
import type { Location } from "@/lib/types"

type LatLngLiteral = google.maps.LatLngLiteral

const fallbackCenter: LatLngLiteral = { lat: -33.9249, lng: 18.4241 }
const defaultOffset = 0.005

function toLatLngLiteral(point: number[]): LatLngLiteral | null {
  if (point.length < 2) return null
  const lat = Number(point[0])
  const lng = Number(point[1])
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  return { lat, lng }
}

function getPolygonPath(bounds?: number[][] | null) {
  if (!bounds?.length) return null
  const points = bounds
    .map((point) => toLatLngLiteral(point))
    .filter((point): point is LatLngLiteral => Boolean(point))
  return points.length ? points : null
}

function buildDefaultGeofence(center: LatLngLiteral, offset = defaultOffset) {
  return [
    { lat: center.lat + offset, lng: center.lng - offset },
    { lat: center.lat + offset, lng: center.lng + offset },
    { lat: center.lat - offset, lng: center.lng + offset },
    { lat: center.lat - offset, lng: center.lng - offset },
  ]
}

function buildPolygonSignature(points: LatLngLiteral[]) {
  return points.map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`).join("|")
}

export function LocationGeofence({
  location,
  accessToken,
}: {
  location: Location
  accessToken?: string
}) {
  const mapRef = React.useRef<HTMLDivElement | null>(null)
  const mapInstance = React.useRef<google.maps.Map | null>(null)
  const polygonRef = React.useRef<google.maps.Polygon | null>(null)
  const centerMarkerRef = React.useRef<google.maps.Marker | null>(null)
  const mapClickListenerRef = React.useRef<google.maps.MapsEventListener | null>(
    null
  )
  const polygonPathListenersRef = React.useRef<
    google.maps.MapsEventListener[]
  >([])
  const polygonDragListenersRef = React.useRef<
    google.maps.MapsEventListener[]
  >([])
  const drawPointsRef = React.useRef<LatLngLiteral[]>([])
  const [loadingMap, setLoadingMap] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [hasPolygon, setHasPolygon] = React.useState(
    Boolean(getPolygonPath(location.polygon_bounds))
  )
  const [drawingMode, setDrawingMode] = React.useState(false)
  const [defaultCenter, setDefaultCenter] = React.useState<LatLngLiteral | null>(
    null
  )
  const savingRef = React.useRef(false)
  const hasQueuedSaveRef = React.useRef(false)
  const lastSavedSignatureRef = React.useRef<string | null>(null)
  const autoSaveEnabledRef = React.useRef(false)
  const autoSaveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const getCurrentPolygonPath = React.useCallback((): LatLngLiteral[] => {
    if (!polygonRef.current) return []
    const path = polygonRef.current.getPath()
    const points: LatLngLiteral[] = []
    for (let i = 0; i < path.getLength(); i += 1) {
      const point = path.getAt(i)
      points.push({ lat: point.lat(), lng: point.lng() })
    }
    return points
  }, [])

  const saveGeofence = React.useCallback(
    async ({ notifySuccess = false, force = false }: { notifySuccess?: boolean; force?: boolean } = {}) => {
      if (!location.location_id || !polygonRef.current) return
      const points = getCurrentPolygonPath()
      const signature = buildPolygonSignature(points)
      if (!force && signature === lastSavedSignatureRef.current) return
      if (savingRef.current) {
        hasQueuedSaveRef.current = true
        return
      }

      savingRef.current = true
      setSaving(true)
      try {
        const bounds = points.map((point) => [point.lat, point.lng])
        const result = await updateLocation(
          location.location_id,
          { polygon_bounds: bounds },
          accessToken
        )
        if (isApiErrorResponse(result)) {
          toast.error(result.message)
          return
        }

        lastSavedSignatureRef.current = signature
        if (notifySuccess) {
          toast.success("Geofence updated.")
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update geofence."
        )
      } finally {
        savingRef.current = false
        setSaving(false)
        if (hasQueuedSaveRef.current) {
          hasQueuedSaveRef.current = false
          void saveGeofence()
        }
      }
    },
    [accessToken, getCurrentPolygonPath, location.location_id]
  )

  const queueAutoSave = React.useCallback(() => {
    if (!autoSaveEnabledRef.current) return
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      void saveGeofence()
    }, 800)
  }, [saveGeofence])

  const clearPolygonPathListeners = React.useCallback(() => {
    polygonPathListenersRef.current.forEach((listener) => listener.remove())
    polygonPathListenersRef.current = []
    polygonDragListenersRef.current.forEach((listener) => listener.remove())
    polygonDragListenersRef.current = []
  }, [])

  const updateCenterMarker = React.useCallback(
    (points: LatLngLiteral[]) => {
      if (!mapInstance.current || !points.length) return
      const bounds = new google.maps.LatLngBounds()
      points.forEach((point) => bounds.extend(point))
      const center = bounds.getCenter()
      if (!centerMarkerRef.current) {
        centerMarkerRef.current = new google.maps.Marker({
          map: mapInstance.current,
          position: center,
          title: "Geofence center",
        })
      } else {
        centerMarkerRef.current.setPosition(center)
        centerMarkerRef.current.setMap(mapInstance.current)
      }
    },
    []
  )

  const attachPolygonPathListeners = React.useCallback(
    (polygon: google.maps.Polygon) => {
      clearPolygonPathListeners()
      const path = polygon.getPath()
      const updateFromPath = () => {
        const nextPoints: LatLngLiteral[] = []
        for (let i = 0; i < path.getLength(); i += 1) {
          const point = path.getAt(i)
          nextPoints.push({ lat: point.lat(), lng: point.lng() })
        }
        updateCenterMarker(nextPoints)
        queueAutoSave()
      }
      polygonPathListenersRef.current = [
        path.addListener("set_at", updateFromPath),
        path.addListener("insert_at", updateFromPath),
        path.addListener("remove_at", updateFromPath),
      ]
      polygonDragListenersRef.current = [
        polygon.addListener("drag", updateFromPath),
        polygon.addListener("dragend", updateFromPath),
      ]
      updateFromPath()
    },
    [clearPolygonPathListeners, queueAutoSave, updateCenterMarker]
  )

  React.useEffect(() => {
    if (!mapRef.current) return
    let cancelled = false
    loadGoogleMaps([])
      .then(() => {
        if (cancelled || !mapRef.current) return
        const center = { lat: Number(location.latitude), lng: Number(location.longitude) }
        console.log("Initializing map with center:", center)

        mapInstance.current = new google.maps.Map(mapRef.current, {
          center,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })
        mapInstance.current.setCenter(center)

        const existingPath = getPolygonPath(location.polygon_bounds)
        const polygonPath = existingPath ?? buildDefaultGeofence(center)
        if (polygonPath) {
          lastSavedSignatureRef.current = buildPolygonSignature(polygonPath)
          polygonRef.current = new google.maps.Polygon({
            paths: polygonPath,
            editable: true,
            draggable: true,
            fillColor: "#2563eb",
            fillOpacity: 0.2,
            strokeColor: "#1d4ed8",
            strokeWeight: 2,
          })
          polygonRef.current.setMap(mapInstance.current)
          const bounds = new google.maps.LatLngBounds()
          polygonPath.forEach((point) => bounds.extend(point))
          mapInstance.current.fitBounds(bounds)
          updateCenterMarker(polygonPath)
          attachPolygonPathListeners(polygonRef.current)
          setHasPolygon(true)
        }
        setDefaultCenter(center)
        autoSaveEnabledRef.current = true

        if (mapClickListenerRef.current) {
          mapClickListenerRef.current.remove()
        }
        mapClickListenerRef.current = mapInstance.current.addListener(
          "click",
          (event: google.maps.MapMouseEvent) => {
            if (!drawingMode || !event.latLng) return
            const nextPoint = {
              lat: event.latLng.lat(),
              lng: event.latLng.lng(),
            }
            drawPointsRef.current = [...drawPointsRef.current, nextPoint]
            const path = drawPointsRef.current
            if (path.length < 2) return
            if (!polygonRef.current) {
              polygonRef.current = new google.maps.Polygon({
                paths: path,
                editable: true,
                draggable: true,
                fillColor: "#16a34a",
                fillOpacity: 0.2,
                strokeColor: "#15803d",
                strokeWeight: 2,
              })
              polygonRef.current.setMap(mapInstance.current)
              attachPolygonPathListeners(polygonRef.current)
            } else {
              polygonRef.current.setPath(path)
            }
            updateCenterMarker(path)
            if (path.length >= 3) {
              setHasPolygon(true)
            }
          }
        )

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
      if (mapClickListenerRef.current) {
        mapClickListenerRef.current.remove()
        mapClickListenerRef.current = null
      }
      clearPolygonPathListeners()
      autoSaveEnabledRef.current = false
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
        autoSaveTimeoutRef.current = null
      }
    }
  }, [
    location.latitude,
    location.longitude,
    location.polygon_bounds,
    drawingMode,
    attachPolygonPathListeners,
    clearPolygonPathListeners,
    updateCenterMarker,
  ])

  const handleDrawNew = () => {
    if (!mapInstance.current) return
    if (polygonRef.current) {
      polygonRef.current.setMap(null)
      polygonRef.current = null
      setHasPolygon(false)
    }
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setMap(null)
      centerMarkerRef.current = null
    }
    clearPolygonPathListeners()
    drawPointsRef.current = []
    setDrawingMode(true)
  }

  const handleClear = () => {
    if (polygonRef.current) {
      polygonRef.current.setMap(null)
      polygonRef.current = null
    }
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setMap(null)
      centerMarkerRef.current = null
    }
    clearPolygonPathListeners()
    drawPointsRef.current = []
    setHasPolygon(false)
    setDrawingMode(false)
  }

  const handleResetDefault = () => {
    if (!mapInstance.current || !defaultCenter) return
    const polygonPath = buildDefaultGeofence(defaultCenter)
    if (polygonRef.current) {
      polygonRef.current.setPath(polygonPath)
    } else {
      polygonRef.current = new google.maps.Polygon({
        paths: polygonPath,
        editable: true,
        draggable: true,
        fillColor: "#2563eb",
        fillOpacity: 0.2,
        strokeColor: "#1d4ed8",
        strokeWeight: 2,
      })
      polygonRef.current.setMap(mapInstance.current)
    }
    updateCenterMarker(polygonPath)
    attachPolygonPathListeners(polygonRef.current)
    const bounds = new google.maps.LatLngBounds()
    polygonPath.forEach((point) => bounds.extend(point))
    mapInstance.current.fitBounds(bounds)
    drawPointsRef.current = []
    setHasPolygon(true)
    setDrawingMode(false)
  }

  const handleCenterMap = () => {
    if (!mapInstance.current) return
    const center = {
      lat: Number(location.latitude),
      lng: Number(location.longitude),
    }
    mapInstance.current.setCenter(center)
  }

  const handleFinish = () => {
    setDrawingMode(false)
  }

  if (loadError?.includes("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to enable geofence editing.
      </div>
    )
  }

  if (
     !location.latitude  || !location.longitude 
  ) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Geofence map requires a valid latitude and longitude for this location.
      </div>
    )
  }

  return (
    <div className="relative min-h-[400px] flex-1 w-full overflow-hidden rounded-lg border">
      {loadingMap ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading map...
        </div>
      ) : null}
      <div className="absolute inset-0" ref={mapRef} />
    </div>
  )
}
