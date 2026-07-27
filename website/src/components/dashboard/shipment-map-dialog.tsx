"use client"

import * as React from "react"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" className="z-[2147483647] sm:w-[min(96vw,1100px)]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Shipment details</DrawerTitle>
          <DrawerDescription>
          Shipment detail, tracking, and label management.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto p-4 pt-10">
          {shipmentId ? (
            <ShipmentDialogContent
              shipmentId={shipmentId}
              accessToken={accessToken}
              merchantId={merchantId}
            />
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
