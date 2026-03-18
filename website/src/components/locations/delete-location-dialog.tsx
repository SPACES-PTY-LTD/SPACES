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
import { deleteLocation } from "@/lib/api/locations"
import type { Location } from "@/lib/types"

export function DeleteLocationDialog({
  location,
  accessToken,
  onDeleted,
  trigger,
}: {
  location: Location
  accessToken?: string
  onDeleted?: () => void
  trigger?: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const handleDelete = async () => {
    if (!location.location_id) {
      toast.error("Missing location id.")
      return
    }
    setLoading(true)
    try {
      const result = await deleteLocation(location.location_id, accessToken)
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Location deleted.")
      setOpen(false)
      onDeleted?.()
      router.push(AdminLinks.locations)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete location.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="destructive">Delete location</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete location</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The location will be removed.
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
