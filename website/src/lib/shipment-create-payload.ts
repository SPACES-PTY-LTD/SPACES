import type { ShipmentQuoteFormValues } from "@/components/shipments/shipment-quote-dialog"
import type { CreateShipmentPayload, Location } from "@/lib/types"

function address(location: Location) {
  const { location_id, ...fields } = location
  return { ...fields, location_id }
}
export function shipmentCreatePayload(values: ShipmentQuoteFormValues, environmentId?: string, autoAssign?: boolean): CreateShipmentPayload & { auto_assign?: boolean } {
  return {
    merchant_id: values.merchantId, environment_id: environmentId, merchant_order_ref: values.merchantOrderRef ?? "",
    delivery_note_number: values.deliveryNoteNumber ?? "", invoice_number: values.invoiceInvoiceNumber ?? "",
    collection_date: values.collectionDate, auto_assign: autoAssign,
    pickup_location_id: values.pickupLocation.location_id, dropoff_location_id: values.dropoffLocation.location_id,
    pickup_address: values.pickupLocation.location_id ? undefined : address(values.pickupLocation),
    dropoff_address: values.dropoffLocation.location_id ? undefined : address(values.dropoffLocation),
    parcels: values.parcels.map(parcel => ({ weight: parcel.weight_kg, weight_measurement: "kg", length_cm: parcel.length_cm,
      width_cm: parcel.width_cm, height_cm: parcel.height_cm, contents_description: parcel.title || undefined })),
  }
}
