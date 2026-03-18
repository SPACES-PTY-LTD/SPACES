import { AdminLinks, AdminRoute } from "@/lib/routes/admin"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import {
  ShipmentQuoteDialog,
  type ShipmentQuoteFormValues,
} from "@/components/shipments/shipment-quote-dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import { createQuote, getShipmentQuotes } from "@/lib/api/quotes"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"
import { revalidatePath } from "next/cache"

type QuotesPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
    sort_by?: string | string[]
    sort_dir?: string | string[]
  }>
}

function normalizeSortBy(value?: string) {
  const allowed = new Set([
    "created_at",
    "merchant_order_ref",
    "collection_date",
    "status",
    "expires_at",
    "requested_at",
  ])
  return allowed.has(value ?? "") ? value ?? "created_at" : "created_at"
}

function normalizeSortDir(value?: string) {
  return value === "asc" ? "asc" : "desc"
}

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
  const params = (await searchParams) ?? {}
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const rawSortBy = Array.isArray(params.sort_by) ? params.sort_by[0] : params.sort_by
  const rawSortDir = Array.isArray(params.sort_dir) ? params.sort_dir[0] : params.sort_dir
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const sortBy = normalizeSortBy(rawSortBy)
  const sortDir = normalizeSortDir(rawSortDir)
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)
  const canLoad = session.user.role === "super_admin" || Boolean(merchantId)
  const response = canLoad
    ? await getShipmentQuotes(session.accessToken, {
        merchant_id: merchantId,
        page,
        sort_by: sortBy,
        sort_dir: sortDir,
      })
    : null
  const isError = response ? isApiErrorResponse(response) : false
  const errorMessage =
    response && isApiErrorResponse(response) ? response.message : null
  const quotes = response && !isApiErrorResponse(response) ? response.data : []
  const loading_error = canLoad
    ? isError
      ? errorMessage
      : null
    : "Select a merchant to view quotes."
  const rows = isError
    ? []
    : quotes.map((quote) => ({
        ...quote,
        href: AdminRoute.quoteDetails(quote.quote_id),
        merchantHref: quote.merchant_id
          ? AdminRoute.merchantDetails(quote.merchant_id)
          : "",
      }))
  const tableMeta =
    response && !isApiErrorResponse(response)
      ? normalizeTableMeta(response.meta)
      : undefined
  const isSuperAdmin = session.user.role === "super_admin"

  const createQuoteAction = async (values: ShipmentQuoteFormValues) => {
    "use server"
    const session = await requireAuth()
    const result = await createQuote(
      {
        merchant_id: values.merchantId,
        merchant_order_ref: values.merchantOrderRef,
        collection_date: values.collectionDate,
        pickup_location: values.pickupLocation,
        dropoff_location: values.dropoffLocation,
        parcels: values.parcels,
      },
      session.accessToken
    )
    if (isApiErrorResponse(result)) {
      return { error: true, message: result.message }
    }
    revalidatePath(AdminLinks.quotes)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        description="Compare carrier pricing and service options."
        actions={
          <ShipmentQuoteDialog
            merchantId={session.selected_merchant?.merchant_id}
            title="Request quote"
            description="Generate new quotes for a shipment."
            triggerLabel="Request quote"
            includeOrderRef
            onSubmit={createQuoteAction}
          />
        }
      />
      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        searchKeys={["merchant_order_ref", "status", "quote_id"]}
        columns={[
          { key: "merchant_order_ref", label: "Order Ref", link: "href" },
          { key: "collection_date", label: "Collection Date", link: "href",type: "date_time",
            format: "YYYY-MM-DD HH:mm"},
          ...(isSuperAdmin
            ? [
                {
                  key: "merchant_id",
                  label: "Merchant",
                  link: "merchantHref",
                },
              ]
            : []),
          { key: "status", label: "Status", type: "status" },
          {
            key: "expires_at",
            label: "Expires At",
            type: "date_time",
            format: "YYYY-MM-DD HH:mm",
          },
          {
            key: "requested_at",
            label: "Requested At",
            type: "date_time",
            format: "YYYY-MM-DD HH:mm",
          },
          { key: "options", label: "Options", type: "count_array" },
        ]}
        rowActions={[
          { label: "View", hrefKey: "href" },
          { label: "Book" },
        ]}
        enableSorting
        sortableColumns={[
          "merchant_order_ref",
          "collection_date",
          "status",
          "expires_at",
          "requested_at",
        ]}
      />
    </div>
  )
}
