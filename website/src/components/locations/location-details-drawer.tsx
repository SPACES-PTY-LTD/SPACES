"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { LocationGeofence } from "@/components/locations/location-geofence"
import { getLocation } from "@/lib/api/locations"
import { isApiErrorResponse } from "@/lib/api/client"
import { formatAddress } from "@/lib/address"
import { AdminRoute } from "@/lib/routes/admin"
import { cn } from "@/lib/utils"
import type { Location } from "@/lib/types"

export function LocationDetailsDrawer({ locationId, label, accessToken, merchantId, children, className, open: controlledOpen, onOpenChange, hideTrigger = false }: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  locationId: string
  label: string
  accessToken: string
  merchantId?: string | null
  children?: ReactNode
  className?: string
}) {
  const [localOpen, setLocalOpen] = useState(false)
  const open = controlledOpen ?? localOpen
  const setOpen = onOpenChange ?? setLocalOpen
  const [location, setLocation] = useState<Location | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      try {
        const response = await getLocation(locationId, accessToken, { merchant_id: merchantId ?? undefined })
        if (cancelled) return
        if (isApiErrorResponse(response)) setError(response.message || "Unable to load location details.")
        else setLocation(response)
      } catch {
        if (!cancelled) setError("Unable to load location details.")
      }
    }
    void load()
    return () => { cancelled = true }
  }, [open, locationId, accessToken, merchantId, attempt])

  const details = location ? [
    ["Type", location.type?.title || "Not set"],
    ["Company", location.company],
    ["Code", location.code],
    ["Address", formatAddress(location)],
    ["Contact", [location.first_name, location.last_name].filter(Boolean).join(" ")],
    ["Phone", location.phone],
    ["Email", location.email],
    ["Expected waiting time", location.expected_waiting_time != null ? `${location.expected_waiting_time} min` : "Not set"],
    ["Latitude", location.latitude],
    ["Longitude", location.longitude],
    ["Tags", location.tags?.map(tag => tag.name).join(", ")],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "") : []

  return <Drawer open={open} onOpenChange={value => {
    setLocation(null)
    setError(null)
    setOpen(value)
  }}>
    {!hideTrigger && <DrawerTrigger asChild>
      <button type="button" className={cn("rounded-sm text-left font-medium underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} aria-label={`View location details for ${label}`}>
        {children ?? label}
      </button>
    </DrawerTrigger>}
    <DrawerContent side="right" className="sm:w-[min(90vw,720px)]">
      <DrawerHeader className="pr-12">
        <DrawerTitle>{location?.name || location?.company || label}</DrawerTitle>
        <DrawerDescription>Location details and geofence.</DrawerDescription>
      </DrawerHeader>
      <div className="space-y-6 overflow-y-auto p-4">
        {error ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => { setError(null); setAttempt(value => value + 1) }}>Retry</Button></div> : !location ? <p role="status" className="text-sm text-muted-foreground">Loading location details…</p> : <>
          <dl className="grid gap-4 sm:grid-cols-2 text-sm">
            {details.map(([name, value]) => <div key={String(name)}><dt className="text-xs text-muted-foreground">{name}</dt><dd className="break-words font-medium">{value}</dd></div>)}
          </dl>
          <LocationGeofence key={location.location_id} location={location} accessToken={accessToken} />
          <Link className="text-sm underline underline-offset-4" href={AdminRoute.locationDetails(location.location_id)}>Open full location page</Link>
        </>}
      </div>
    </DrawerContent>
  </Drawer>
}
