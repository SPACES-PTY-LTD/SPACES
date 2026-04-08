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
import { updateShipmentInvoiceNumber } from "@/lib/api/shipments"

const DELIVERY_NOTE_REQUIRED_MESSAGE =
  "Delivery note number is required before updating the invoice number."

export function UpdateInvoiceNumberDialog({
  open,
  onOpenChange,
  shipmentId,
  invoiceNumber,
  deliveryNoteNumber,
  accessToken,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shipmentId: string
  invoiceNumber?: string
  deliveryNoteNumber?: string
  accessToken?: string | null
}) {
  const router = useRouter()
  const [value, setValue] = React.useState(invoiceNumber ?? "")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setValue(invoiceNumber ?? "")
  }, [open, invoiceNumber])

  const handleSave = async () => {
    if (!value.trim()) {
      toast.error("Enter an invoice number.")
      return
    }

    if (!deliveryNoteNumber?.trim()) {
      toast.error(DELIVERY_NOTE_REQUIRED_MESSAGE)
      return
    }

    setSaving(true)
    try {
      const result = await updateShipmentInvoiceNumber(
        shipmentId,
        value.trim(),
        accessToken
      )
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Invoice number updated.")
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update invoice number."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update invoice number</DialogTitle>
          <DialogDescription>
            Save the invoice number on this shipment.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="invoice-number">Invoice number</Label>
          <Input
            id="invoice-number"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Enter invoice number"
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
