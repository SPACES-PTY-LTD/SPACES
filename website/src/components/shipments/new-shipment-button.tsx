import { ShipmentQuoteDialog, type ShipmentQuoteFormValues } from "@/components/shipments/shipment-quote-dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import { createShipment } from "@/lib/api/shipments"
import { requireAuth } from "@/lib/auth"
import { AdminLinks } from "@/lib/routes/admin"
import type { Location } from "@/lib/types"
import { revalidatePath } from "next/cache"

function toShipmentAddress(location: Location) {
  return {
    location_id: location.location_id ?? undefined,
    location_type_id: location.location_type_id ?? undefined,
    name: location.name ?? undefined,
    code: location.code ?? undefined,
    company: location.company ?? undefined,
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

export function NewShipmentButton({ merchantId }: { merchantId?: string }) {
  const createShipmentAction = async (values: ShipmentQuoteFormValues) => {
    "use server"
    const session = await requireAuth()
    const result = await createShipment(
      {
        merchant_id: values.merchantId,
        merchant_order_ref: values.merchantOrderRef ?? "",
        delivery_note_number: values.deliveryNoteNumber ?? "",
        invoice_number: values.invoiceInvoiceNumber ?? "",
        collection_date: values.collectionDate,
        pickup_location_id: values.pickupLocation.location_id,
        dropoff_location_id: values.dropoffLocation.location_id,
        pickup_address: values.pickupLocation.location_id
          ? undefined
          : toShipmentAddress(values.pickupLocation),
        dropoff_address: values.dropoffLocation.location_id
          ? undefined
          : toShipmentAddress(values.dropoffLocation),
        parcels: values.parcels.map((parcel) => ({
          weight: parcel.weight_kg,
          weight_measurement: "kg",
          length_cm: parcel.length_cm,
          width_cm: parcel.width_cm,
          height_cm: parcel.height_cm,
          contents_description: parcel.title || undefined,
        })),
      },
      session.accessToken
    )
    if (isApiErrorResponse(result)) {
      return { error: true, message: result.message }
    }
    revalidatePath(AdminLinks.shipments)
    revalidatePath(AdminLinks.reportsShipments)
  }

  return (
    <ShipmentQuoteDialog
      merchantId={merchantId}
      title="Create shipment"
      description="Capture pickup, destination, and parcel details."
      triggerLabel="New shipment"
      includeOrderRef
      includeInvoicedAt={false}
      onSubmit={createShipmentAction}
    />
  )
}
