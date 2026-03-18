"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isApiErrorResponse } from "@/lib/api/client"
import { listDriverVehicles } from "@/lib/api/driver-vehicles"
import { assignShipmentVehicle } from "@/lib/api/shipments"
import type { Vehicle } from "@/lib/types"

function buildVehicleLabel(vehicle: Vehicle) {
  const title =
    vehicle.plate_number ??
    vehicle.ref_code ??
    vehicle.vehicle_id ??
    "Unnamed vehicle"
  const description = [vehicle.make, vehicle.model].filter(Boolean).join(" ")
  return description ? `${title} • ${description}` : title
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

function toIsoDateTime(value: string) {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

export function AssignShipmentVehicleDialog({
  open,
  onOpenChange,
  shipmentId,
  driverId,
  collectionDate,
  accessToken,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shipmentId: string
  driverId?: string | null
  collectionDate?: string | null
  accessToken?: string | null
}) {
  const router = useRouter()
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([])
  const [vehicleId, setVehicleId] = React.useState("")
  const [loadingVehicles, setLoadingVehicles] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [dateValue, setDateValue] = React.useState(toDateTimeLocal(collectionDate))

  React.useEffect(() => {
    if (!open) return
    setVehicleId("")
    setVehicles([])
    setDateValue(toDateTimeLocal(collectionDate))
  }, [open, collectionDate])

  React.useEffect(() => {
    if (!open || !driverId) return
    let active = true

    ;(async () => {
      setLoadingVehicles(true)
      try {
        const response = await listDriverVehicles(driverId, accessToken)
        if (!active) return
        if (isApiErrorResponse(response)) {
          toast.error(response.message)
          return
        }
        setVehicles(response.data ?? [])
      } catch (error) {
        if (!active) return
        toast.error(
          error instanceof Error ? error.message : "Failed to load vehicles."
        )
      } finally {
        if (active) {
          setLoadingVehicles(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [accessToken, driverId, open])

  const handleSave = async () => {
    if (!driverId) {
      toast.error("You must select a driver first.")
      return
    }
    if (!vehicleId) {
      toast.error("Select a vehicle.")
      return
    }
    const nextCollectionDate = collectionDate ? undefined : toIsoDateTime(dateValue)
    if (!collectionDate && !nextCollectionDate) {
      toast.error("Select a collection date.")
      return
    }

    setSaving(true)
    try {
      const result = await assignShipmentVehicle(
        shipmentId,
        {
          vehicle_id: vehicleId,
          collection_date: nextCollectionDate,
        },
        accessToken
      )
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Vehicle assigned.")
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to assign vehicle."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign vehicle</DialogTitle>
          <DialogDescription>
            {driverId
              ? "Select one of the driver vehicles for this shipment."
              : "You must select a driver first."}
          </DialogDescription>
        </DialogHeader>
        {!driverId ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            You must select a driver first.
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Vehicle</Label>
              <Select
                value={vehicleId}
                onValueChange={setVehicleId}
                disabled={loadingVehicles || vehicles.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      loadingVehicles
                        ? "Loading vehicles..."
                        : vehicles.length === 0
                          ? "No vehicles found"
                          : "Select a vehicle"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => {
                    const value =
                      vehicle.vehicle_id ??
                      vehicle.vehicle_uuid ??
                      vehicle.driver_vehicle_id
                    if (!value) return null
                    return (
                      <SelectItem key={value} value={value}>
                        {buildVehicleLabel(vehicle)}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            {!collectionDate ? (
              <div className="grid gap-2">
                <Label htmlFor="assign-vehicle-collection-date">
                  Collection date
                </Label>
                <Input
                  id="assign-vehicle-collection-date"
                  type="datetime-local"
                  value={dateValue}
                  onChange={(event) => setDateValue(event.target.value)}
                />
              </div>
            ) : null}
          </div>
        )}
        {driverId ? (
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !driverId}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
          ) : null}
      </DialogContent>
    </Dialog>
  )
}
