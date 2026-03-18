"use client"

import { AdminLinks } from "@/lib/routes/admin"
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
import { isApiErrorResponse } from "@/lib/api/client"
import { deleteRoute } from "@/lib/api/routes"
import type { Route } from "@/lib/types"

export function DeleteRouteDialog({
  route,
  accessToken,
}: {
  route: Route
  accessToken?: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const handleDelete = async () => {
    if (!route.route_id) {
      toast.error("Missing route id.")
      return
    }

    setLoading(true)
    try {
      const result = await deleteRoute(route.route_id, accessToken)
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Route deleted.")
      setOpen(false)
      router.push(AdminLinks.routes)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete route.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete route</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete route</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The route and its stop mappings will be removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? "Deleting..." : "Confirm delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
