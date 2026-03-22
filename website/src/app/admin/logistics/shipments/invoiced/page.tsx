import { AdminRoute } from "@/lib/routes/admin"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { isApiErrorResponse } from "@/lib/api/client"
import { listShipments } from "@/lib/api/shipments"
import { formatAddress } from "@/lib/address"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

export default async function InvoicedShipmentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const pageParam = resolvedSearchParams.page
  const sortByParam = resolvedSearchParams.sort_by
  const sortDirParam = resolvedSearchParams.sort_dir
  const rawPage = Array.isArray(pageParam) ? pageParam[0] : pageParam
  const sortBy = Array.isArray(sortByParam) ? sortByParam[0] : sortByParam
  const rawSortDir = Array.isArray(sortDirParam) ? sortDirParam[0] : sortDirParam
  const sortDir = rawSortDir === "asc" || rawSortDir === "desc" ? rawSortDir : undefined
  const parsedPage = rawPage ? Number(rawPage) : undefined
  const pageNumber =
    parsedPage && Number.isFinite(parsedPage) && parsedPage > 0
      ? Math.floor(parsedPage)
      : undefined
  const canLoad = session.user.role === "super_admin" || Boolean(merchantId)

  const response = canLoad
    ? await listShipments(session.accessToken, {
        page: pageNumber,
        merchant_id: merchantId,
        invoiced: true,
        sort_by: sortBy,
        sort_dir: sortDir,
      })
    : null

  const isError = response ? isApiErrorResponse(response) : false
  const errorMessage =
    response && isApiErrorResponse(response) ? response.message : null
  const shipments =
    response && !isApiErrorResponse(response) ? response.data : []
  const loadingError = canLoad
    ? isError
      ? errorMessage
      : null
    : "Select a merchant to view invoiced shipments."

  const rows = isError
    ? []
    : shipments.map((shipment) => ({
        ...shipment,
        href: AdminRoute.shipmentDetails(shipment.shipment_id),
        invoice_number:
          shipment.invoice_number ?? shipment.invoice_invoice_number ?? "",
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoiced Shipments"
        description="View shipments that have already been invoiced."
      />

      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loadingError}
        enableSorting
        sortKeyMap={{
          "merchant.name": "merchant_name",
        }}
        searchKeys={[
          "merchant_order_ref",
          "delivery_note_number",
          "invoice_number",
          "pickup_location",
          "dropoff_location",
        ]}
        filters={[
          {
            key: "status",
            label: "Filter by status",
            options: [
              { label: "Ready", value: "ready" },
              { label: "In Transit", value: "in_transit" },
              { label: "Delivered", value: "delivered" },
            ],
          },
        ]}
        columns={[
          { key: "merchant_order_ref", label: "Reference", link: "href" },
          { key: "delivery_note_number", label: "Delivery Note", link: "href" },
          { key: "invoice_number", label: "Invoice Number", link: "href" },
          { key: "invoiced_at", label: "Invoiced At", link: "href", type: "date_time", format: "YYYY-MM-DD HH:mm" },
          { key: "collection_date", label: "Collection Date", link: "href", type: "date_time", format: "YYYY-MM-DD HH:mm" },
          ...(isSuperAdmin
            ? [
                {
                  key: "merchant.name",
                  label: "Merchant",
                  link: "merchantHref",
                },
              ]
            : []),
          { key: "pickup_location", label: "From", link: "href" },
          { key: "dropoff_location", label: "To", link: "href" },
          { key: "status", label: "Status", type: "status" },
          { key: "parcels", label: "Parcels Count", type: "count_array" },
          { key: "created_at", label: "Created", type: "date_time", format: "YYYY-MM-DD HH:mm" },
        ]}
      />
    </div>
  )
}
