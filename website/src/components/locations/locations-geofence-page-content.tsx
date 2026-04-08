"use client"

import * as React from "react"
import { MarkerClusterer, MarkerUtils, type Marker } from "@googlemaps/markerclusterer"
import { Loader2, MapPin, RotateCcw, Search, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  PlacesSuggestions,
  type PlaceSelection,
} from "@/components/locations/places-suggestions"
import { isApiErrorResponse } from "@/lib/api/client"
import { listLocations, updateLocation, type LocationPayload } from "@/lib/api/locations"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"
import type { ApiListResponse, Location } from "@/lib/types"

type LatLngLiteral = google.maps.LatLngLiteral

type PaginationMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type LocationDraft = {
  name: string
  fullAddress: string
  addressLine1: string
  addressLine2: string
  town: string
  city: string
  province: string
  postCode: string
  country: string
  latitude: number | null
  longitude: number | null
  googlePlaceId: string
}

type MarkerEntry = {
  locationId: string
  marker: Marker
}

type PolygonEntry = {
  locationId: string
  polygon: google.maps.Polygon
}

const fallbackCenter: LatLngLiteral = { lat: -33.9249, lng: 18.4241 }
const defaultZoom = 6
const selectedZoom = 17
const defaultGeofenceOffset = 0.001
const googleMapsMapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID

function normalizeMeta(meta?: ApiListResponse<Location>["meta"]): PaginationMeta | null {
  if (!meta) return null

  const currentPage = meta.current_page ?? meta.page
  const perPage = meta.per_page ?? meta.perPage
  const total = meta.total
  const lastPage =
    meta.last_page ??
    (typeof perPage === "number" && perPage > 0 && typeof total === "number"
      ? Math.max(1, Math.ceil(total / perPage))
      : undefined)

  if (
    typeof currentPage !== "number" ||
    typeof perPage !== "number" ||
    typeof total !== "number" ||
    typeof lastPage !== "number"
  ) {
    return null
  }

  return {
    current_page: currentPage,
    last_page: lastPage,
    per_page: perPage,
    total,
  }
}

function mergeLocations(existing: Location[], incoming: Location[]) {
  const byId = new Map<string, Location>()
  existing.forEach((location) => byId.set(location.location_id, location))
  incoming.forEach((location) => byId.set(location.location_id, location))
  return Array.from(byId.values())
}

function getLocationLabel(location: Location) {
  return location.name || location.company || location.code || "Unnamed location"
}

function getLocationAddress(location: Location) {
  return (
    location.full_address ||
    [
      location.address_line_1,
      location.address_line_2,
      location.town,
      location.city,
      location.province,
      location.post_code,
      location.country,
    ]
      .filter(Boolean)
      .join(", ")
  )
}

function toLatLngLiteral(location: Location): LatLngLiteral | null {
  const lat = Number(location.latitude)
  const lng = Number(location.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function toPolygonPath(bounds?: number[][] | null): LatLngLiteral[] | null {
  if (!bounds?.length) return null
  const points = bounds
    .map((point) => {
      const lat = Number(point[0])
      const lng = Number(point[1])
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { lat, lng }
    })
    .filter((point): point is LatLngLiteral => Boolean(point))

  return points.length >= 3 ? points : null
}

function buildDefaultGeofence(center: LatLngLiteral, offset = defaultGeofenceOffset) {
  return [
    { lat: center.lat + offset, lng: center.lng - offset },
    { lat: center.lat + offset, lng: center.lng + offset },
    { lat: center.lat - offset, lng: center.lng + offset },
    { lat: center.lat - offset, lng: center.lng - offset },
  ]
}

function getCurrentPolygonPath(polygon: google.maps.Polygon | null) {
  if (!polygon) return []
  const path = polygon.getPath()
  const points: LatLngLiteral[] = []
  for (let index = 0; index < path.getLength(); index += 1) {
    const point = path.getAt(index)
    points.push({ lat: point.lat(), lng: point.lng() })
  }
  return points
}

function createDraft(location: Location | null): LocationDraft {
  return {
    name: location?.name ?? "",
    fullAddress: location ? getLocationAddress(location) : "",
    addressLine1: location?.address_line_1 ?? "",
    addressLine2: location?.address_line_2 ?? "",
    town: location?.town ?? "",
    city: location?.city ?? "",
    province: location?.province ?? "",
    postCode: location?.post_code ?? "",
    country: location?.country ?? "",
    latitude:
      location?.latitude !== null && location?.latitude !== undefined
        ? Number(location.latitude)
        : null,
    longitude:
      location?.longitude !== null && location?.longitude !== undefined
        ? Number(location.longitude)
        : null,
    googlePlaceId: location?.google_place_id ?? "",
  }
}

function getMarkerIconUrl(selected: boolean) {
  const fill = selected ? "#dc2626" : "#2563eb"
  const markerSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <path d="M24 2C14.1 2 6 10.1 6 20c0 12.4 14.9 24.9 17.1 26.7a1.5 1.5 0 0 0 1.8 0C27.1 44.9 42 32.4 42 20 42 10.1 33.9 2 24 2z" fill="${fill}" />
      <circle cx="24" cy="20" r="8" fill="#ffffff" />
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSvg)}`
}

function createMarkerContent(selected: boolean) {
  const image = document.createElement("img")
  image.src = getMarkerIconUrl(selected)
  image.alt = ""
  image.style.width = selected ? "48px" : "38px"
  image.style.height = selected ? "48px" : "38px"
  image.style.display = "block"
  return image
}

function createLocationMarker(
  map: google.maps.Map,
  position: LatLngLiteral,
  title: string,
  selected: boolean,
  useAdvancedMarkers: boolean
): Marker {
  if (useAdvancedMarkers && MarkerUtils.isAdvancedMarkerAvailable(map)) {
    return new google.maps.marker.AdvancedMarkerElement({
      position,
      title,
      content: createMarkerContent(selected),
      zIndex: selected ? 999 : 1,
    })
  }

  return new google.maps.Marker({
    position,
    title,
  })
}

function updateMarkerAppearance(entry: MarkerEntry, selected: boolean) {
  if (MarkerUtils.isAdvancedMarker(entry.marker)) {
    entry.marker.content = createMarkerContent(selected)
    entry.marker.zIndex = selected ? 999 : 1
    return
  }

  entry.marker.setIcon({
    url: getMarkerIconUrl(selected),
    scaledSize: new google.maps.Size(selected ? 48 : 38, selected ? 48 : 38),
    anchor: new google.maps.Point(selected ? 24 : 19, selected ? 47 : 37),
  })
  entry.marker.setZIndex(selected ? 999 : 1)
}

function getMarkerPosition(marker: Marker) {
  return MarkerUtils.isAdvancedMarker(marker)
    ? MarkerUtils.getPosition(marker)
    : marker.getPosition()
}

function isTrustedMapClick(event: google.maps.MapMouseEvent) {
  return !event.domEvent || event.domEvent.isTrusted
}

export function LocationsGeofencePageContent({
  accessToken,
  merchantId,
  initialLocations,
  initialMeta,
  initialError,
}: {
  accessToken: string
  merchantId?: string | null
  initialLocations: Location[]
  initialMeta?: ApiListResponse<Location>["meta"]
  initialError?: string | null
}) {
  const initialPerPage = React.useMemo(
    () => normalizeMeta(initialMeta)?.per_page ?? 100,
    [initialMeta]
  )
  const [locations, setLocations] = React.useState<Location[]>(initialLocations)
  const [meta, setMeta] = React.useState<PaginationMeta | null>(() =>
    normalizeMeta(initialMeta)
  )
  const [searchTerm, setSearchTerm] = React.useState("")
  const [activeSearch, setActiveSearch] = React.useState<string | undefined>()
  const [loadingError, setLoadingError] = React.useState<string | null>(
    initialError ?? null
  )
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [searching, setSearching] = React.useState(false)
  const [selectedLocationId, setSelectedLocationId] = React.useState<string | null>(
    null
  )

  const hasMore = Boolean(meta && meta.current_page < meta.last_page)
  const selectedLocation = selectedLocationId
    ? locations.find((location) => location.location_id === selectedLocationId) ?? null
    : null

  const handleSelectLocation = React.useCallback((locationId: string) => {
    setSelectedLocationId((previous) =>
      previous === locationId ? previous : locationId
    )
  }, [])

  const runLocationQuery = React.useCallback(
    async (search?: string) => {
      setSearching(true)
      setLoadingError(null)
      const response = await listLocations(accessToken, {
        merchant_id: merchantId ?? undefined,
        page: 1,
        per_page: initialPerPage,
        search,
        sort_by: "name",
        sort_dir: "asc",
      })

      if (isApiErrorResponse(response)) {
        setLoadingError(response.message)
        setSearching(false)
        return
      }

      setActiveSearch(search)
      setLocations(response.data)
      setMeta(normalizeMeta(response.meta))
      setSelectedLocationId(null)
      setSearching(false)
    },
    [accessToken, initialPerPage, merchantId]
  )

  const handleLoadMore = React.useCallback(async () => {
    if (!meta || loadingMore || !hasMore) return

    setLoadingMore(true)
    setLoadingError(null)
    const response = await listLocations(accessToken, {
      merchant_id: merchantId ?? undefined,
      page: meta.current_page + 1,
      per_page: meta.per_page,
      search: activeSearch,
      sort_by: "name",
      sort_dir: "asc",
    })

    if (isApiErrorResponse(response)) {
      setLoadingError(response.message)
      setLoadingMore(false)
      return
    }

    setLocations((previous) => mergeLocations(previous, response.data))
    setMeta((previousMeta) => normalizeMeta(response.meta) ?? previousMeta)
    setLoadingMore(false)
  }, [accessToken, activeSearch, hasMore, loadingMore, merchantId, meta])

  React.useEffect(() => {
    const normalizedSearch = searchTerm.trim() || undefined
    if (normalizedSearch === activeSearch) return

    const timeoutId = window.setTimeout(() => {
      void runLocationQuery(normalizedSearch)
    }, 350)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeSearch, runLocationQuery, searchTerm])

  const handleLocationSaved = React.useCallback((location: Location) => {
    setLocations((previous) =>
      previous.map((item) =>
        item.location_id === location.location_id ? { ...item, ...location } : item
      )
    )
  }, [])

  return (
    <div className="flex min-h-[calc(100vh-11rem)] overflow-hidden rounded-md border bg-background">
      <aside className="flex w-full max-w-sm flex-col border-r bg-background">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search locations"
              className="pl-9"
              disabled={searching}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto max-h-[calc(100vh-15rem)]">
          {loadingError && locations.length === 0 ? (
            <div className="p-4 text-sm text-destructive">{loadingError}</div>
          ) : null}

          {locations.map((location) => {
            const selected = location.location_id === selectedLocationId
            return (
              <button
                type="button"
                key={location.location_id}
                className={`flex w-full items-start gap-3 border-b px-3 py-3 text-left text-sm transition-colors ${
                  selected ? "bg-primary/10" : "hover:bg-muted/60"
                }`}
                onClick={(event) => {
                  if (!event.isTrusted) return
                  handleSelectLocation(location.location_id)
                }}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary">
                  <MapPin className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {getLocationLabel(location)}
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {getLocationAddress(location) || "No address captured"}
                  </span>
                </span>
              </button>
            )
          })}

          {!loadingError && locations.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No locations found.</div>
          ) : null}

          {hasMore && !loadingMore && !searching ? (
            <div className="p-3">
              <Button
                type="button"
                className="w-full"
                variant="outline"
                onClick={handleLoadMore}
              >
                Load more locations
              </Button>
            </div>
          ) : null}

          {loadingMore || searching ? (
            <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {searching ? "Searching..." : "Loading more..."}
            </div>
          ) : null}

          {loadingError && locations.length > 0 ? (
            <div className="space-y-2 p-3">
              <div className="text-sm text-destructive">{loadingError}</div>
              {hasMore ? (
                <Button className="w-full" variant="outline" onClick={handleLoadMore}>
                  Retry load more
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>

      <LocationsGeofenceMap
        accessToken={accessToken}
        locations={locations}
        selectedLocation={selectedLocation}
        selectedLocationId={selectedLocationId}
        onSelectLocation={handleSelectLocation}
        onClearSelection={() => setSelectedLocationId(null)}
        onLocationSaved={handleLocationSaved}
      />
    </div>
  )
}

function LocationsGeofenceMap({
  accessToken,
  locations,
  selectedLocation,
  selectedLocationId,
  onSelectLocation,
  onClearSelection,
  onLocationSaved,
}: {
  accessToken: string
  locations: Location[]
  selectedLocation: Location | null
  selectedLocationId: string | null
  onSelectLocation: (locationId: string) => void
  onClearSelection: () => void
  onLocationSaved: (location: Location) => void
}) {
  const mapRef = React.useRef<HTMLDivElement | null>(null)
  const mapInstance = React.useRef<google.maps.Map | null>(null)
  const markersRef = React.useRef<MarkerEntry[]>([])
  const polygonsRef = React.useRef<PolygonEntry[]>([])
  const selectedPolygonRef = React.useRef<google.maps.Polygon | null>(null)
  const markerClusterRef = React.useRef<MarkerClusterer | null>(null)
  const [draft, setDraft] = React.useState<LocationDraft>(() =>
    createDraft(selectedLocation)
  )
  const [loadingMap, setLoadingMap] = React.useState(true)
  const [mapReady, setMapReady] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const hasDraftCoordinates =
    Number.isFinite(Number(draft.latitude)) && Number.isFinite(Number(draft.longitude))

  const clearMapEntries = React.useCallback(() => {
    markerClusterRef.current?.clearMarkers()
    markerClusterRef.current = null
    markersRef.current.forEach((entry) => MarkerUtils.setMap(entry.marker, null))
    markersRef.current = []
    polygonsRef.current.forEach((entry) => entry.polygon.setMap(null))
    polygonsRef.current = []
    selectedPolygonRef.current = null
  }, [])

  React.useEffect(() => {
    setDraft(createDraft(selectedLocation))
  }, [selectedLocation])

  React.useEffect(() => {
    if (!mapRef.current) return
    let cancelled = false

    loadGoogleMaps(googleMapsMapId ? ["marker"] : [])
      .then(() => {
        if (cancelled || !mapRef.current) return
        if (!mapInstance.current) {
          mapInstance.current = new google.maps.Map(mapRef.current, {
            center: fallbackCenter,
            zoom: defaultZoom,
            ...(googleMapsMapId ? { mapId: googleMapsMapId } : {}),
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
          })
        }
        setMapReady(true)
        setLoadingMap(false)
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(
          error instanceof Error ? error.message : "Failed to load Google Maps."
        )
        setLoadingMap(false)
      })

    return () => {
      cancelled = true
      clearMapEntries()
    }
  }, [clearMapEntries])

  React.useEffect(() => {
    if (!mapReady || !mapInstance.current) return

    clearMapEntries()
    const bounds = new google.maps.LatLngBounds()
    let hasBounds = false

    for (const location of locations) {
      const position = toLatLngLiteral(location)

      if (position) {
        const marker = createLocationMarker(
          mapInstance.current,
          position,
          getLocationLabel(location),
          false,
          Boolean(googleMapsMapId)
        )
        const markerEntry = { locationId: location.location_id, marker }
        updateMarkerAppearance(markerEntry, false)
        marker.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (!isTrustedMapClick(event)) return
          onSelectLocation(location.location_id)
        })
        markersRef.current.push(markerEntry)
        bounds.extend(position)
        hasBounds = true
      }

      const polygonPath = toPolygonPath(location.polygon_bounds)
      if (polygonPath) {
        const polygon = new google.maps.Polygon({
          paths: polygonPath,
          clickable: true,
          editable: false,
          draggable: false,
          fillColor: "#2563eb",
          fillOpacity: 0.12,
          strokeColor: "#1d4ed8",
          strokeWeight: 1,
        })
        polygon.setMap(mapInstance.current)
        polygon.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (!isTrustedMapClick(event)) return
          onSelectLocation(location.location_id)
        })
        polygonsRef.current.push({ locationId: location.location_id, polygon })
      }
    }

    if (markersRef.current.length > 0) {
      markerClusterRef.current = new MarkerClusterer({
        map: mapInstance.current,
        markers: markersRef.current.map((entry) => entry.marker),
      })
    }

    if (hasBounds) {
      mapInstance.current.fitBounds(bounds)
    } else if (!hasBounds) {
      mapInstance.current.setCenter(fallbackCenter)
      mapInstance.current.setZoom(defaultZoom)
    }
  }, [clearMapEntries, locations, mapReady, onSelectLocation])

  React.useEffect(() => {
    if (!mapReady || !mapInstance.current) return

    markersRef.current.forEach((entry) => {
      updateMarkerAppearance(entry, entry.locationId === selectedLocationId)
    })

    selectedPolygonRef.current = null
    polygonsRef.current.forEach((entry) => {
      const selected = entry.locationId === selectedLocationId
      entry.polygon.setOptions({
        editable: selected,
        draggable: selected,
        fillColor: selected ? "#ef4444" : "#2563eb",
        fillOpacity: selected ? 0.28 : 0.12,
        strokeColor: selected ? "#dc2626" : "#1d4ed8",
        strokeWeight: selected ? 2 : 1,
      })
      if (selected) selectedPolygonRef.current = entry.polygon
    })

    if (!selectedLocationId) return

    const marker = markersRef.current.find(
      (entry) => entry.locationId === selectedLocationId
    )?.marker
    const position = marker ? getMarkerPosition(marker) : null
    if (!position) return

    mapInstance.current.panTo(position)
    if ((mapInstance.current.getZoom() ?? defaultZoom) < selectedZoom) {
      mapInstance.current.setZoom(selectedZoom)
    }
  }, [mapReady, selectedLocationId])

  const setSelectedPolygonPath = React.useCallback((path: LatLngLiteral[]) => {
    if (!mapInstance.current || !selectedLocation) return

    if (!selectedPolygonRef.current) {
      const polygon = new google.maps.Polygon({
        paths: path,
        editable: true,
        draggable: true,
        fillColor: "#ef4444",
        fillOpacity: 0.28,
        strokeColor: "#dc2626",
        strokeWeight: 2,
      })
      polygon.setMap(mapInstance.current)
      selectedPolygonRef.current = polygon
      polygonsRef.current.push({
        locationId: selectedLocation.location_id,
        polygon,
      })
    } else {
      selectedPolygonRef.current.setPath(path)
      selectedPolygonRef.current.setEditable(true)
      selectedPolygonRef.current.setDraggable(true)
      selectedPolygonRef.current.setMap(mapInstance.current)
    }

    const bounds = new google.maps.LatLngBounds()
    path.forEach((point) => bounds.extend(point))
    mapInstance.current.fitBounds(bounds)
  }, [selectedLocation])

  const handlePlaceChange = React.useCallback((selection: PlaceSelection) => {
    setDraft((previous) => ({
      ...previous,
      fullAddress: selection.formattedAddress || previous.fullAddress,
      addressLine1: selection.addressLine1 || previous.addressLine1,
      addressLine2: selection.addressLine2 || previous.addressLine2,
      town: selection.town || previous.town,
      city: selection.city || previous.city,
      province: selection.province || previous.province,
      postCode: selection.postCode || previous.postCode,
      country: selection.country || previous.country,
      latitude:
        typeof selection.latitude === "number"
          ? selection.latitude
          : previous.latitude,
      longitude:
        typeof selection.longitude === "number"
          ? selection.longitude
          : previous.longitude,
      googlePlaceId: selection.googlePlaceId || previous.googlePlaceId,
    }))
  }, [])

  const handleResetPolygon = React.useCallback(() => {
    const lat = Number(draft.latitude)
    const lng = Number(draft.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("Select an address with coordinates before resetting the polygon.")
      return
    }

    setSelectedPolygonPath(buildDefaultGeofence({ lat, lng }))
  }, [draft.latitude, draft.longitude, setSelectedPolygonPath])

  const handleSave = React.useCallback(async () => {
    if (!selectedLocation) return
    if (!draft.name.trim()) {
      toast.error("Name is required.")
      return
    }

    const polygonPath = getCurrentPolygonPath(selectedPolygonRef.current)
    const payload: Partial<LocationPayload> = {
      name: draft.name.trim(),
      full_address: draft.fullAddress || null,
      address_line_1: draft.addressLine1 || null,
      address_line_2: draft.addressLine2 || null,
      town: draft.town || null,
      city: draft.city || null,
      province: draft.province || null,
      post_code: draft.postCode || null,
      country: draft.country || null,
      latitude: draft.latitude,
      longitude: draft.longitude,
      google_place_id: draft.googlePlaceId || null,
    }

    if (polygonPath.length >= 3) {
      payload.polygon_bounds = polygonPath.map((point) => [point.lat, point.lng])
    }

    setSaving(true)
    const result = await updateLocation(selectedLocation.location_id, payload, accessToken)
    setSaving(false)

    if (isApiErrorResponse(result)) {
      toast.error(result.message)
      return
    }

    const responseLocation =
      result && typeof result === "object" && "data" in result
        ? (result as { data?: Location }).data
        : (result as Location)
    const nextLocation: Location = {
      ...selectedLocation,
      ...responseLocation,
      name: draft.name.trim(),
      full_address: draft.fullAddress || null,
      address_line_1: draft.addressLine1 || undefined,
      address_line_2: draft.addressLine2 || null,
      town: draft.town || null,
      city: draft.city || null,
      province: draft.province || null,
      post_code: draft.postCode || null,
      country: draft.country || null,
      latitude: draft.latitude,
      longitude: draft.longitude,
      google_place_id: draft.googlePlaceId || null,
      polygon_bounds: payload.polygon_bounds ?? selectedLocation.polygon_bounds,
      location_id: selectedLocation.location_id,
    }
    onLocationSaved(nextLocation)
    toast.success("Location geofence updated.")
  }, [accessToken, draft, onLocationSaved, selectedLocation])

  if (loadError?.includes("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to enable geofence editing.
      </div>
    )
  }

  return (
    <div className="relative min-w-0 flex-1 overflow-hidden bg-secondary">
      {loadingMap ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
          Loading map...
        </div>
      ) : null}
      <div className="absolute inset-0" ref={mapRef} />

      {selectedLocation ? (
        <div className="absolute bottom-4 right-4 z-10 w-[min(440px,calc(100%-2rem))] rounded-md border bg-background/95 p-4 shadow-lg backdrop-blur">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                {getLocationLabel(selectedLocation)}
              </div>
              <div className="text-xs text-muted-foreground">
                {hasDraftCoordinates
                  ? "Drag polygon points or reset the polygon, then save your changes."
                  : "Search for an address to set coordinates before editing the polygon."}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClearSelection}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Location name
              </label>
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Address
              </label>
              <PlacesSuggestions
                onChange={handlePlaceChange}
                countryCode="za"
                placeholder="Search address"
                initialQuery={draft.fullAddress}
                resetKey={selectedLocation.location_id}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetPolygon}
                disabled={saving}
              >
                <RotateCcw className="h-4 w-4" />
                Reset polygon
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={onClearSelection}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
