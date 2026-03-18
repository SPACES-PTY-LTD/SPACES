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
import { updateDriver } from "@/lib/api/drivers"
import type { Driver } from "@/lib/types"

export function DeactivateDriverDialog({
  driver,
  accessToken,
  onUpdated,
  trigger,
}: {
  driver: Driver
  accessToken?: string
  onUpdated?: () => void
  trigger?: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const handleDeactivate = async () => {
    setLoading(true)
    try {
      const result = await updateDriver(
        driver.driver_id,
        { is_active: false },
        accessToken
      )
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Driver deactivated.")
      setOpen(false)
      onUpdated?.()
      router.push(AdminLinks.drivers)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to deactivate driver."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="destructive">Deactivate</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate driver</DialogTitle>
          <DialogDescription>
            This will mark the driver as inactive and remove them from
            assignments.
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
            onClick={handleDeactivate}
            disabled={loading}
          >
            {loading ? "Deactivating..." : "Confirm deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
