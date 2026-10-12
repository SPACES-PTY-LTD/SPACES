"use client"

import { useEffect, useState } from "react"
import type { ShipmentStop } from "@/lib/types"
import { shipmentLocationTime } from "./shipment-location-time"

export function ShipmentLocationTimeCell({ stops, pickupId, dropoffId, initialNow, startedAt, completedAt, isActive, vehicleId }: {
  stops: ShipmentStop[]
  pickupId?: string
  dropoffId?: string
  initialNow: string
  startedAt?: string | null
  completedAt?: string | null
  isActive: boolean
  vehicleId?: string
}) {
  const [now, setNow] = useState(initialNow)
  const options = { now, startedAt, completedAt, isActive, vehicleId }
  const pickup = shipmentLocationTime(stops, pickupId, options)
  const dropoff = shipmentLocationTime(stops, dropoffId, options)
  const isOpen = pickup.isOpen || dropoff.isOpen
  useEffect(() => {
    if (!isOpen) return
    const timer = window.setInterval(() => setNow(new Date().toISOString()), 60_000)
    return () => window.clearInterval(timer)
  }, [isOpen])

  return <div className="space-y-1 whitespace-nowrap tabular-nums">
    <div><span className="text-muted-foreground">Pickup: </span>{pickup.label}{pickup.isOpen ? " (ongoing)" : ""}</div>
    <div><span className="text-muted-foreground">Drop-off: </span>{dropoff.label}{dropoff.isOpen ? " (ongoing)" : ""}</div>
  </div>
}
