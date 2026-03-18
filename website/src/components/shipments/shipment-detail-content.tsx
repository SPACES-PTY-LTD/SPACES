import { revalidatePath } from "next/cache"
import { AdminLinks } from "@/lib/routes/admin"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { ErrorMessage } from "@/components/common/error-message"
import { ShipmentDetailView } from "@/components/shipments/shipment-detail-view"
import type { ShipmentQuoteFormValues } from "@/components/shipments/shipment-quote-dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import { getShipment, updateShipment } from "@/lib/api/shipments"

export async function ShipmentDetailContent({
  shipmentId,
  accessToken,
  merchantId,
  defaultTab,
  embedded = false,
}: {
  shipmentId: string
  accessToken: string
  merchantId?: string | null
  defaultTab?: string
  embedded?: boolean
}) {
  const shipment = await getShipment(shipmentId, accessToken, {
    merchant_id: merchantId ?? undefined,
  })

  if (isApiErrorResponse(shipment)) {
    return (
      <ErrorMessage
        title="Shipment"
        description="Shipment detail, tracking, and label management."
        message={shipment.message}
      />
    )
  }

  const editShipmentAction = async (values: ShipmentQuoteFormValues) => {
    "use server"

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
      return { error: true, message: result.message }
    }

    revalidatePath(`${AdminLinks.shipments}/${shipmentId}`)
    revalidatePath(AdminLinks.shipments)
    revalidatePath(AdminLinks.dashboard)
  }

  return (
    <div className={embedded ? undefined : "space-y-6"}>
      {!embedded ? (
        <Breadcrumbs
          items={[
            { label: "Shipments", href: AdminLinks.shipments },
            { label: shipment.merchant_order_ref ?? shipment.shipment_id },
          ]}
        />
      ) : null}
      <ShipmentDetailView
        shipment={shipment}
        shipmentId={shipmentId}
        accessToken={accessToken}
        merchantId={merchantId}
        defaultTab={defaultTab}
        embedded={embedded}
        onEditSubmit={editShipmentAction}
      />
    </div>
  )
}
