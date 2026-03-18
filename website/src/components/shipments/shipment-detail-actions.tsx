"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AssignShipmentDriverDialog } from "@/components/shipments/assign-shipment-driver-dialog"
import { AssignShipmentVehicleDialog } from "@/components/shipments/assign-shipment-vehicle-dialog"
import { ShipmentPrintDialog } from "@/components/shipments/shipment-print-dialog"
import {
  ShipmentQuoteDialog,
  type ShipmentQuoteFormValues,
} from "@/components/shipments/shipment-quote-dialog"
import { UpdateDeliveryNoteDialog } from "@/components/shipments/update-delivery-note-dialog"
import { UpdateInvoiceNumberDialog } from "@/components/shipments/update-invoice-number-dialog"
import type { Location, ShipmentParcelInput, Shipment } from "@/lib/types"

type DialogKey =
  | "print"
  | "deliveryNote"
  | "invoice"
  | "driver"
  | "vehicle"
  | null

type ShipmentEditInitialValues = {
  merchantId: string
  merchantOrderRef?: string
  deliveryNoteNumber?: string
  invoiceInvoiceNumber?: string
  invoicedAt?: string
  collectionDate: string
  pickupLocation?: Location
  dropoffLocation?: Location
  parcels: ShipmentParcelInput[]
}

export function ShipmentDetailActions({
  shipment,
  shipmentDriverId,
  shipmentDriverName,
  shipmentVehicleName,
  runDriverExists,
  runVehicleExists,
  deliveryNoteNumber,
  invoiceNumber,
  selectedMerchantId,
  accessToken,
  editInitialValues,
  onEditSubmit,
}: {
  shipment: Shipment
  shipmentDriverId?: string | null
  shipmentDriverName?: string | null
  shipmentVehicleName?: string | null
  runDriverExists: boolean
  runVehicleExists: boolean
  deliveryNoteNumber: string
  invoiceNumber: string
  selectedMerchantId?: string | null
  accessToken?: string | null
  editInitialValues: ShipmentEditInitialValues
  onEditSubmit: (values: ShipmentQuoteFormValues) => Promise<unknown>
}) {
  const [activeDialog, setActiveDialog] = React.useState<DialogKey>(null)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label="Shipment actions">
            Actions <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <ShipmentQuoteDialog
            merchantId={shipment.merchant_id}
            title="Edit shipment"
            description="Update shipment details."
            triggerLabel="Edit shipment"
            submitLabel="Save changes"
            includeOrderRef
            initialValues={editInitialValues}
            onSubmit={onEditSubmit}
            trigger={
              <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                Edit shipment
              </DropdownMenuItem>
            }
          />
          <DropdownMenuItem onSelect={() => setActiveDialog("print")}>
            Print
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveDialog("deliveryNote")}>
            Update delivery note
          </DropdownMenuItem>
          {!shipment.invoiced_at ? (
            <DropdownMenuItem onSelect={() => setActiveDialog("invoice")}>
              Update invoice number
            </DropdownMenuItem>
          ) : null}
          {!runDriverExists ? (
            <DropdownMenuItem onSelect={() => setActiveDialog("driver")}>
              Assign driver
            </DropdownMenuItem>
          ) : null}
          {!runVehicleExists ? (
            <DropdownMenuItem onSelect={() => setActiveDialog("vehicle")}>
              Assign vehicle
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ShipmentPrintDialog
        open={activeDialog === "print"}
        onOpenChange={(open) => setActiveDialog(open ? "print" : null)}
        shipment={shipment}
        invoiceNumber={invoiceNumber}
        driverName={shipmentDriverName}
        vehicleName={shipmentVehicleName}
      />

      <UpdateDeliveryNoteDialog
        open={activeDialog === "deliveryNote"}
        onOpenChange={(open) => setActiveDialog(open ? "deliveryNote" : null)}
        shipmentId={shipment.shipment_id}
        deliveryNoteNumber={deliveryNoteNumber}
        accessToken={accessToken}
      />

      <UpdateInvoiceNumberDialog
        open={activeDialog === "invoice"}
        onOpenChange={(open) => setActiveDialog(open ? "invoice" : null)}
        shipmentId={shipment.shipment_id}
        invoiceNumber={invoiceNumber}
        accessToken={accessToken}
      />

      <AssignShipmentDriverDialog
        open={activeDialog === "driver"}
        onOpenChange={(open) => setActiveDialog(open ? "driver" : null)}
        shipmentId={shipment.shipment_id}
        merchantId={selectedMerchantId ?? shipment.merchant_id ?? editInitialValues.merchantId}
        plannedStartAt={shipment.collection_date}
        hasRun={Boolean(shipment.run_id)}
        accessToken={accessToken}
      />

      <AssignShipmentVehicleDialog
        open={activeDialog === "vehicle"}
        onOpenChange={(open) => setActiveDialog(open ? "vehicle" : null)}
        shipmentId={shipment.shipment_id}
        driverId={shipmentDriverId}
        collectionDate={shipment.collection_date}
        accessToken={accessToken}
      />
    </>
  )
}
