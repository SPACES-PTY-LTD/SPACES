"use client"

import * as React from "react"
import { toast } from "sonner"
import { ErrorMessage } from "@/components/common/error-message"
import { ShipmentDetailView } from "@/components/shipments/shipment-detail-view"
import type { ShipmentQuoteFormValues } from "@/components/shipments/shipment-quote-dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import { getShipment, updateShipment } from "@/lib/api/shipments"
import type { Location, Shipment } from "@/lib/types"

function toShipmentAddress(location: Location) {
  return {
    location_id: location.location_id ?? undefined,
    location_type_id: location.location_type_id ?? undefined,
    name: location.name ?? undefined,
    code: location.code ?? undefined,
    company: location.company ?? undefined,
    full_address: location.full_address ?? undefined,
    address_line_1: location.address_line_1 ?? undefined,
    address_line_2: location.address_line_2 ?? undefined,
    town: location.town ?? undefined,
    city: location.city ?? undefined,
    country: location.country ?? undefined,
    first_name: location.first_name ?? undefined,
    last_name: location.last_name ?? undefined,
    phone: location.phone ?? undefined,
    email: location.email ?? undefined,
    province: location.province ?? undefined,
    post_code: location.post_code ?? undefined,
    latitude: location.latitude ?? undefined,
    longitude: location.longitude ?? undefined,
    google_place_id: location.google_place_id ?? undefined,
  }
}

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
          pickup_location_id: values.pickupLocation.location_id,
          dropoff_location_id: values.dropoffLocation.location_id,
          pickup_address: values.pickupLocation.location_id
            ? undefined
            : toShipmentAddress(values.pickupLocation),
          dropoff_address: values.dropoffLocation.location_id
            ? undefined
            : toShipmentAddress(values.dropoffLocation),
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
