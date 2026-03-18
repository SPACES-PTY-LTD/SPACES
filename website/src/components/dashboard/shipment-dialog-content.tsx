"use client"

import * as React from "react"
import { toast } from "sonner"
import { ErrorMessage } from "@/components/common/error-message"
import { ShipmentDetailView } from "@/components/shipments/shipment-detail-view"
import type { ShipmentQuoteFormValues } from "@/components/shipments/shipment-quote-dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import { getShipment, updateShipment } from "@/lib/api/shipments"
import type { Shipment } from "@/lib/types"

export function ShipmentDialogContent({
  shipmentId,
  accessToken,
  merchantId,
}: {
  shipmentId: string
  accessToken: string
  merchantId?: string | null
}) {
  const [shipment, setShipment] = React.useState<Shipment | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadShipment = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    const response = await getShipment(shipmentId, accessToken, {
      merchant_id: merchantId ?? undefined,
    })

    if (isApiErrorResponse(response)) {
      setShipment(null)
      setError(response.message)
      setLoading(false)
      return
    }

    setShipment(response)
    setLoading(false)
  }, [accessToken, merchantId, shipmentId])

  React.useEffect(() => {
    void loadShipment()
  }, [loadShipment])

  const handleEditSubmit = React.useCallback(
    async (values: ShipmentQuoteFormValues) => {
      const result = await updateShipment(
        shipmentId,
        {
          merchant_order_ref: values.merchantOrderRef ?? "",
          delivery_note_number: values.deliveryNoteNumber ?? "",
          invoice_invoice_number: values.invoiceInvoiceNumber ?? "",
          invoice_number: values.invoiceInvoiceNumber ?? "",
          invoiced_at: values.invoicedAt,
          collection_date: values.collectionDate,
          pickup_location: values.pickupLocation,
          dropoff_location: values.dropoffLocation,
          parcels: values.parcels,
        },
        accessToken
      )

      if (isApiErrorResponse(result)) {
        return result
      }

      toast.success("Shipment updated.")
      await loadShipment()
      return result
    },
    [accessToken, loadShipment, shipmentId]
  )

  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center text-sm text-muted-foreground">
        Loading shipment...
      </div>
    )
  }

  if (error || !shipment) {
    return (
      <ErrorMessage
        title="Shipment"
        description="Shipment detail, tracking, and label management."
        message={error ?? "Failed to load shipment."}
      />
    )
  }

  return (
    <ShipmentDetailView
      shipment={shipment}
      shipmentId={shipmentId}
      accessToken={accessToken}
      merchantId={merchantId}
      embedded
      onEditSubmit={handleEditSubmit}
    />
  )
}
