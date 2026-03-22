import { AdminLinks, AdminRoute } from "@/lib/routes/admin"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import {
  ShipmentQuoteDialog,
  type ShipmentQuoteFormValues,
} from "@/components/shipments/shipment-quote-dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import { createShipment, listShipments } from "@/lib/api/shipments"
import { formatAddress } from "@/lib/address"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"
import type { Location } from "@/lib/types"
import { revalidatePath } from "next/cache"

function toShipmentAddress(location: Location) {
  return {
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

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const statusParam = resolvedSearchParams.status
  const priorityParam = resolvedSearchParams.priority
  const autoAssignParam = resolvedSearchParams.auto_assign
  const invoicedParam = resolvedSearchParams.invoiced
  const fromParam = resolvedSearchParams.from
  const toParam = resolvedSearchParams.to
  const pageParam = resolvedSearchParams.page
  const perPageParam = resolvedSearchParams.per_page
  const sortByParam = resolvedSearchParams.sort_by
  const sortDirParam = resolvedSearchParams.sort_dir
  const status = Array.isArray(statusParam) ? statusParam[0] : statusParam
  const priority = Array.isArray(priorityParam) ? priorityParam[0] : priorityParam
  const autoAssign = Array.isArray(autoAssignParam)
    ? autoAssignParam[0]
    : autoAssignParam
  const invoiced = Array.isArray(invoicedParam) ? invoicedParam[0] : invoicedParam
  const from = Array.isArray(fromParam) ? fromParam[0] : fromParam
  const to = Array.isArray(toParam) ? toParam[0] : toParam
  const page = Array.isArray(pageParam) ? pageParam[0] : pageParam
  const perPage = Array.isArray(perPageParam) ? perPageParam[0] : perPageParam
  const sortBy = Array.isArray(sortByParam) ? sortByParam[0] : sortByParam
  const rawSortDir = Array.isArray(sortDirParam) ? sortDirParam[0] : sortDirParam
  const sortDir = rawSortDir === "asc" || rawSortDir === "desc" ? rawSortDir : undefined
  const parsedPage = page ? Number(page) : undefined
  const pageNumber =
    parsedPage && Number.isFinite(parsedPage) && parsedPage > 0
      ? Math.floor(parsedPage)
      : undefined
  const canLoad = session.user.role === "super_admin" || Boolean(merchantId)
  const response = canLoad
    ? await listShipments(session.accessToken, {
        merchant_id: merchantId,
        page: pageNumber,
        status: status || undefined,
        priority: priority || undefined,
        auto_assign:
          autoAssign === "true" ? true : autoAssign === "false" ? false : undefined,
        invoiced:
          invoiced === "true" ? true : invoiced === "false" ? false : undefined,
        from: from || undefined,
        to: to || undefined,
        per_page: perPage ? Number(perPage) : undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      })
    : null
  const isError = response ? isApiErrorResponse(response) : false
  const errorMessage =
    response && isApiErrorResponse(response) ? response.message : null
  const shipments =
    response && !isApiErrorResponse(response) ? response.data : []
  const loading_error = canLoad
    ? isError
      ? errorMessage
      : null
    : "Select a merchant to view shipments."

  const rows = isError
    ? []
    : shipments.map((shipment) => ({
        ...shipment,
        href: AdminRoute.shipmentDetails(shipment.shipment_id),
        dropoff_location: formatAddress(
          shipment.dropoff_location ?? shipment.dropoff_address
        ),
        pickup_location: formatAddress(
          shipment.pickup_location ?? shipment.pickup_address
        ),
        merchantHref: shipment.merchant_id
          ? AdminRoute.merchantDetails(shipment.merchant_id)
          : "",
      }))
  const tableMeta =
    response && !isApiErrorResponse(response)
      ? normalizeTableMeta(response.meta)
      : undefined
  const isSuperAdmin = session.user.role === "super_admin"

  const createShipmentAction = async (values: ShipmentQuoteFormValues) => {
    "use server"
    const session = await requireAuth()
    const result = await createShipment(
      {
        merchant_id: values.merchantId,
        merchant_order_ref: values.merchantOrderRef ?? "",
        delivery_note_number: values.deliveryNoteNumber ?? "",
        invoice_number: values.invoiceInvoiceNumber ?? "",
        invoiced_at: values.invoicedAt,
        collection_date: values.collectionDate,
        pickup_address: toShipmentAddress(values.pickupLocation),
        dropoff_address: toShipmentAddress(values.dropoffLocation),
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
  }



  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipments"
        description="Track shipments, labels, and live status updates."
        actions={
          <ShipmentQuoteDialog
            merchantId={session.selected_merchant?.merchant_id}
            title="Create shipment"
            description="Capture pickup, destination, and parcel details."
            triggerLabel="New shipment"
            includeOrderRef
            onSubmit={createShipmentAction}
          />
        }
      />
      <DataTable
        views={[
          {
            label: "All",
            link: "/admin/logistics/shipments",
          },
          {
            label: "Ready for Pickup",
            link: "/admin/logistics/shipments?status=ready",
          },
          {
            label: "In Transit",
            link: "/admin/logistics/shipments?status=in_transit",
          },
          {
            label: "Delivered",
            link: "/admin/logistics/shipments?status=delivered",
          },
        ]}
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        enableSorting
        sortKeyMap={{
          "merchant.name": "merchant_name",
        }}
        searchKeys={["merchant_order_ref", "delivery_note_number", "pickup_location", "dropoff_location"]}
        filters={[
          {
            key: "status",
            label: "Status",
            value: status ?? "",
            url_param_name: "status",
            options: [
              { label: "Draft", value: "draft" },
              { label: "Booked", value: "booked" },
              { label: "In Transit", value: "in_transit" },
              { label: "Delivered", value: "delivered" },
              { label: "Cancelled", value: "cancelled" },
              { label: "Failed", value: "failed" },
              { label: "Driver Offer Failed", value: "offer_failed" },
            ],
          },
          {
            key: "priority",
            label: "Priority",
            value: priority ?? "",
            url_param_name: "priority",
            options: [
              { label: "Low", value: "low" },
              { label: "Normal", value: "normal" },
              { label: "High", value: "high" },
              { label: "Urgent", value: "urgent" },
            ],
          },
          {
            key: "auto_assign",
            label: "Auto assign",
            value: autoAssign ?? "",
            url_param_name: "auto_assign",
            options: [
              { label: "Enabled", value: "true" },
              { label: "Disabled", value: "false" },
            ],
          },
          {
            key: "invoiced",
            label: "Invoiced",
            value: invoiced ?? "",
            url_param_name: "invoiced",
            options: [
              { label: "Invoiced", value: "true" },
              { label: "Not invoiced", value: "false" },
            ],
          },
          {
            key: "from",
            label: "Created from",
            type: "date",
            value: from ?? "",
            url_param_name: "from",
          },
          {
            key: "to",
            label: "Created to",
            type: "date",
            value: to ?? "",
            url_param_name: "to",
          },
          //per page
          {
            key: "per_page",
            label: "Per page",
            value: tableMeta?.per_page ? String(tableMeta.per_page) : "",
            url_param_name: "per_page",
            type: "select",
            options: [
              { label: "10", value: "10" },
              { label: "20", value: "20" },
              { label: "50", value: "50" },
              { label: "100", value: "100" },
            ],
          },
        ]}
        columns={[
          { key: "merchant_order_ref", label: "Reference", link: "href" },
          { key: "delivery_note_number", label: "Delivery Note", link: "href" },
          { key: "collection_date", label: "Collection Date", link: "href" },
          ...(isSuperAdmin
            ? [
                {
                  key: "merchant.name",
                  label: "Merchant",
                  link: "merchantHref",
                },
              ]
            : []),
          {
            key: "pickup_location",
            label: "From",
            link: "href",
          },
          { key: "dropoff_location", label: "To", link: "href" },
          {
            key: "status",
            label: "Status",
            type: "status",
          },
          { key: "parcels", label: "Parcels Count", type: "count_array" },
          { key: "created_at", label: "Created", type: "date_time", format: "YYYY-MM-DD HH:mm", link: "href" },
        ]}
      />

    </div>
  )
}
