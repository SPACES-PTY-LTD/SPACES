"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { ShipmentDialogContent } from "@/components/dashboard/shipment-dialog-content"

export function ShipmentMapDialog({
  open,
  shipmentId,
  accessToken,
  merchantId,
  onOpenChange,
}: {
  open: boolean
  shipmentId?: string | null
  accessToken: string
  merchantId?: string | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[2147483647] max-h-[92vh] overflow-y-auto sm:max-w-5xl"
        overlayClassName="z-[2147483647]"
      >
        <DialogTitle className="sr-only">Shipment details</DialogTitle>
        <DialogDescription className="sr-only">
          Shipment detail, tracking, and label management.
        </DialogDescription>
        {shipmentId ? (
          <ShipmentDialogContent
            shipmentId={shipmentId}
            accessToken={accessToken}
            merchantId={merchantId}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
