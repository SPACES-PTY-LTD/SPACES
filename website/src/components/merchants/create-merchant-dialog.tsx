"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { isApiErrorResponse } from "@/lib/api/client"
import { createMerchant, listMerchants } from "@/lib/api/merchants"

export function CreateMerchantDialog() {
  const { data: session, update } = useSession()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Merchant name is required.")
      return
    }
    if (!session?.accessToken) {
      setError("Missing session.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const created = await createMerchant(
        { name: name.trim() },
        session.accessToken
      )
      if (isApiErrorResponse(created)) {
        const message = created.message ?? "Failed to create merchant."
        setError(message)
        toast.error(message)
        return
      }
      const refreshed = await listMerchants(session.accessToken)
      if (isApiErrorResponse(refreshed)) {
        const message = refreshed.message ?? "Failed to refresh merchants."
        setError(message)
        toast.error(message)
        return
      }
      await update({
        merchants: refreshed.data,
        selected_merchant: created,
      })
      toast.success("Merchant created.")
      setOpen(false)
      setName("")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create merchant."
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
          New Merchant
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create merchant</DialogTitle>
          <DialogDescription>
            Add a new merchant workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Merchant name</label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Merchant name"
          />
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create merchant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
