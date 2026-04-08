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
import { isApiErrorResponse } from "@/lib/api/client"
import { updateShipmentDeliveryNoteNumber } from "@/lib/api/shipments"

export function UpdateDeliveryNoteDialog({
  open,
  onOpenChange,
  shipmentId,
  deliveryNoteNumber,
  accessToken,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shipmentId: string
  deliveryNoteNumber?: string
  accessToken?: string | null
}) {
  const router = useRouter()
  const [value, setValue] = React.useState(deliveryNoteNumber ?? "")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setValue(deliveryNoteNumber ?? "")
  }, [open, deliveryNoteNumber])

  const handleSave = async () => {
    if (!value.trim()) {
      toast.error("Enter a delivery note.")
      return
    }

    setSaving(true)
    try {
      const result = await updateShipmentDeliveryNoteNumber(
        shipmentId,
        value.trim(),
        accessToken
      )
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Delivery note updated.")
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update delivery note."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update delivery note</DialogTitle>
          <DialogDescription>
            Save the delivery note number on this shipment.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="delivery-note-number">Delivery note</Label>
          <Input
            id="delivery-note-number"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Enter delivery note"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
