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
import { AdminLinks } from "@/lib/routes/admin"
import { isApiErrorResponse } from "@/lib/api/client"
import { deleteVehicle } from "@/lib/api/vehicles"
import type { Vehicle } from "@/lib/types"

export function DeleteVehicleDialog({
  vehicle,
  accessToken,
  onDeleted,
  trigger,
}: {
  vehicle: Vehicle
  accessToken?: string
  onDeleted?: () => void
  trigger?: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const handleDelete = async () => {
    const vehicleId =
      vehicle.vehicle_uuid ?? vehicle.vehicle_id ?? vehicle.driver_vehicle_id
    if (!vehicleId) {
      toast.error("Missing vehicle id.")
      return
    }
    setLoading(true)
    try {
      const result = await deleteVehicle(vehicleId, accessToken)
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Vehicle deleted.")
      setOpen(false)
      onDeleted?.()
      router.push(AdminLinks.vehicles)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete vehicle.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="destructive">Delete vehicle</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete vehicle</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The vehicle will be removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Confirm delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
