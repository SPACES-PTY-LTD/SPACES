import { shipmentParcelPayload, parcelEditorMetadata } from "./shipment-parcel-units"
import type { UpdateShipmentPayload } from "./api/shipments"
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
    invoiced_at: values.invoiceInvoiceNumber?.trim() ? values.invoicedAt : undefined,
    collection_date: values.collectionDate, priority: values.priority ?? "normal", auto_assign: autoAssign,
    pickup_location_id: values.pickupLocation.location_id, dropoff_location_id: values.dropoffLocation.location_id,
    pickup_address: values.pickupLocation.location_id ? undefined : address(values.pickupLocation),
    dropoff_address: values.dropoffLocation.location_id ? undefined : address(values.dropoffLocation),
    metadata: parcelEditorMetadata(values.parcels),
    parcels: shipmentParcelPayload(values.parcels),
  }
}

export function shipmentUpdatePayload(values: ShipmentQuoteFormValues, metadata?: Record<string, unknown> | null): UpdateShipmentPayload {
  return {
    merchant_order_ref: values.merchantOrderRef ?? "",
    delivery_note_number: values.deliveryNoteNumber ?? "",
    invoice_invoice_number: values.invoiceInvoiceNumber ?? "",
    invoice_number: values.invoiceInvoiceNumber ?? "",
    invoiced_at: values.invoiceInvoiceNumber?.trim() ? values.invoicedAt : undefined,
    collection_date: values.collectionDate,
    pickup_location_id: values.pickupLocation.location_id,
    dropoff_location_id: values.dropoffLocation.location_id,
    pickup_address: values.pickupLocation.location_id ? undefined : address(values.pickupLocation),
    dropoff_address: values.dropoffLocation.location_id ? undefined : address(values.dropoffLocation),
    parcels: shipmentParcelPayload(values.parcels),
    metadata: parcelEditorMetadata(values.parcels, metadata),
  }
}
