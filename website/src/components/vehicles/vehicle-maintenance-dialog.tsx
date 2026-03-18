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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { isApiErrorResponse } from "@/lib/api/client"
import { updateVehicleMaintenance } from "@/lib/api/vehicles"
import type { Vehicle } from "@/lib/types"

export function VehicleMaintenanceDialog({
  vehicle,
  accessToken,
  trigger,
}: {
  vehicle: Vehicle
  accessToken?: string
  trigger: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [expectedResolvedAt, setExpectedResolvedAt] = React.useState("")
  const [description, setDescription] = React.useState("")
  const isInMaintenance = Boolean(vehicle.maintenance_mode_at)
  const vehicleId =
    vehicle.vehicle_uuid ?? vehicle.vehicle_id ?? vehicle.driver_vehicle_id ?? ""

  React.useEffect(() => {
    if (!open) return

    setExpectedResolvedAt(
      vehicle.maintenance_expected_resolved_at
        ? vehicle.maintenance_expected_resolved_at.slice(0, 10)
        : ""
    )
    setDescription(vehicle.maintenance_description ?? "")
  }, [open, vehicle.maintenance_expected_resolved_at, vehicle.maintenance_description])

  const handleSubmit = async () => {
    if (!vehicleId) {
      toast.error("Missing vehicle id.")
      return
    }

    if (!isInMaintenance) {
      if (!expectedResolvedAt) {
        toast.error("Expected maintenance resolve date is required.")
        return
      }

      if (!description.trim()) {
        toast.error("Maintenance description is required.")
        return
      }
    }

    setLoading(true)
    const response = await updateVehicleMaintenance(
      vehicleId,
      isInMaintenance
        ? { maintenance_mode: false }
        : {
            maintenance_mode: true,
            maintenance_expected_resolved_at: expectedResolvedAt,
            maintenance_description: description.trim(),
          },
      accessToken
    )

    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to update maintenance mode.")
      setLoading(false)
      return
    }

    toast.success(
      isInMaintenance
        ? "Vehicle removed from maintenance mode."
        : "Vehicle put in maintenance mode."
    )
    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isInMaintenance ? "Remove maintenance mode" : "Put in maintenance mode"}
          </DialogTitle>
          <DialogDescription>
            {isInMaintenance
              ? "Confirm that this vehicle is ready to leave maintenance mode."
              : "Confirm that this vehicle should be taken out of fleet rotation for maintenance."}
          </DialogDescription>
        </DialogHeader>
        {!isInMaintenance ? (
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Expected resolve date
              </label>
              <Input
                type="date"
                value={expectedResolvedAt}
                onChange={(event) => setExpectedResolvedAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Maintenance description
              </label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                placeholder="Describe the maintenance work required."
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={loading}>
            {loading
              ? "Saving..."
              : isInMaintenance
                ? "Remove maintenance"
                : "Confirm maintenance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
