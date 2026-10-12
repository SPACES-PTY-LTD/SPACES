"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { LocationDialog } from "@/components/locations/location-dialog"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"
import type { Location, ShipmentStop } from "@/lib/types"
import { recordedStopCoordinates, recordedStopLocationValues } from "./recorded-stop-location"

export function RecordedStopDrawer({ stop, label, merchantId, accessToken }: {
  stop: ShipmentStop
  label: string
  merchantId?: string | null
  accessToken: string
}) {
  const [open, setOpen] = useState(false)
  return <Drawer open={open} onOpenChange={setOpen}>
    <DrawerTrigger asChild>
      <button type="button" className="rounded-sm text-left font-medium underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`View recorded stop ${label}`}>{label}</button>
    </DrawerTrigger>
    <DrawerContent side="right" className="sm:w-[min(90vw,900px)]">
      {open && <RecordedStopDetails stop={stop} label={label} merchantId={merchantId} accessToken={accessToken} onSaved={() => setOpen(false)} />}
    </DrawerContent>
  </Drawer>
}

function RecordedStopDetails({ stop, label, merchantId, accessToken, onSaved }: {
  stop: ShipmentStop
  label: string
  merchantId?: string | null
  accessToken: string
  onSaved: (location: Location) => void
}) {
  const coordinates = recordedStopCoordinates(stop)
  const lat = coordinates?.lat
  const lng = coordinates?.lng
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapError, setMapError] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [address, setAddress] = useState<google.maps.GeocoderResult>()
  const [addressStatus, setAddressStatus] = useState("Looking up address…")
  const [initialValues, setInitialValues] = useState<Partial<Location>>(() => recordedStopLocationValues(stop))

  useEffect(() => {
    if (lat === undefined || lng === undefined) return
    const center = { lat, lng }
    let cancelled = false
    let marker: google.maps.Marker | undefined
    let map: google.maps.Map | undefined
    async function load() {
      try {
        await loadGoogleMaps([])
        if (cancelled || !mapRef.current) return
        map = new google.maps.Map(mapRef.current, { center, zoom: 16, streetViewControl: false, mapTypeControl: false })
        marker = new google.maps.Marker({ map, position: center, title: label })
        setMapReady(true)
      } catch {
        if (!cancelled) {
          setMapError(true)
          setAddressStatus("Address lookup unavailable. Enter the details manually.")
        }
        return
      }
      try {
        await loadGoogleMaps(["geocoding"])
        if (cancelled) return
        const response = await new google.maps.Geocoder().geocode({ location: center })
        if (cancelled) return
        setAddress(response.results[0])
        setAddressStatus(response.results[0] ? "Review the suggested address before saving." : "No address found. Enter the details manually.")
      } catch {
        if (!cancelled) setAddressStatus("Address lookup unavailable. Enter the details manually.")
      }
    }
    void load()
    return () => {
      cancelled = true
      marker?.setMap(null)
      if (map) google.maps.event.clearInstanceListeners(map)
    }
  }, [lat, lng, label])

  return <>
    <DrawerHeader className="pr-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <DrawerTitle>{label}</DrawerTitle>
          <DrawerDescription>Recorded stop without a saved location.</DrawerDescription>
        </div>
        <LocationDialog merchantId={merchantId} lockMerchant accessToken={accessToken} initialValues={initialValues} onSaved={onSaved}
          trigger={<Button disabled={!coordinates || !merchantId} className="h-auto whitespace-normal text-left" onClick={() => setInitialValues(recordedStopLocationValues(stop, address))}>Create new location from coordinates</Button>} />
      </div>
    </DrawerHeader>
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {coordinates ? <>
        <p className="text-sm">Coordinates: {lat}, {lng}</p>
        <div className="relative h-[min(60vh,560px)] min-h-72 overflow-hidden rounded-lg border">
          <div ref={mapRef} className="absolute inset-0" aria-label="Recorded stop map" />
          {!mapReady && <div className="absolute inset-0 flex items-center justify-center bg-muted p-4 text-sm" role="status">{mapError ? "Map unavailable. You can still create a location using the recorded coordinates." : "Loading map…"}</div>}
        </div>
        {address && <p className="text-sm">Suggested address: {address.formatted_address}</p>}
        <p className="text-sm text-muted-foreground" role="status">{addressStatus}</p>
        {!merchantId && <p className="text-sm text-muted-foreground">A run merchant is required to create a location.</p>}
      </> : <p className="text-sm text-muted-foreground">This stop has no valid recorded coordinates. A map and location creation are unavailable.</p>}
    </div>
  </>
}
