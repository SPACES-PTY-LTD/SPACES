import { AdminRoute } from "@/lib/routes/admin"
import { CreateResourceDialog } from "@/components/common/create-resource-dialog"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { DatePicker } from "@/components/common/date-picker"
import { isApiErrorResponse } from "@/lib/api/client"
import { listBookings } from "@/lib/api/bookings"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

type BookingsPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
    sort_by?: string | string[]
    sort_dir?: string | string[]
  }>
}

function normalizeSortBy(value?: string) {
  const allowed = new Set([
    "created_at",
    "uuid",
    "shipment_id",
    "status",
    "booked_at",
  ])
  return allowed.has(value ?? "") ? value ?? "created_at" : "created_at"
}

function normalizeSortDir(value?: string) {
  return value === "asc" ? "asc" : "desc"
}

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
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
  type BookingRow = Record<string, unknown> & {
    booking_id: string
    shipment_id?: string
    status: string
    driverNameDisplay: string
    scheduledAt?: string | null
    href: string
    merchantHref: string
    merchant?: { name?: string }
  }
  const response = canLoad
    ? await listBookings(session.accessToken, session.user.role, {
        merchant_id: merchantId,
        page,
        sort_by: sortBy,
        sort_dir: sortDir,
      })
    : null
  const isError = response ? isApiErrorResponse(response) : false
  const errorMessage =
    response && isApiErrorResponse(response) ? response.message : null
  const bookings = response && !isApiErrorResponse(response) ? response.data : []
  const loading_error = canLoad
    ? isError
      ? errorMessage
      : null
    : "Select a merchant to view bookings."
  const rows: BookingRow[] = isError
    ? []
    : bookings.map((booking) => ({
        booking_id: booking.booking_id,
        shipment_id: booking.shipment_id,
        status: booking.status,
        driverNameDisplay: booking.driver?.name || "Unassigned",
        scheduledAt: booking.booked_at ?? null,
        merchant: (booking as { merchant?: { name?: string } }).merchant,
        href: AdminRoute.bookingDetails(booking.booking_id),
        merchantHref: booking.merchant_id
          ? AdminRoute.merchantDetails(booking.merchant_id)
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
        title="Bookings"
        description="Assign drivers, manage cancellations, and monitor pickup windows."
        actions={
          <>
            <DatePicker />
            <CreateResourceDialog
              title="Create booking"
              description="Book a shipment for dispatch."
              triggerLabel="New booking"
              shipmentSearchToken={session.accessToken}
              shipmentMerchantId={merchantId}
              fields={[
                {
                  name: "shipment",
                  label: "Shipment ID",
                  type: "shipment_search",
                  required: true,
                },
                {
                  name: "quote",
                  label: "Shipment Quote",
                  type: "shipment_quotes",
                  dependsOn: "shipment",
                  required: true,
                },
                { name: "schedule", label: "Schedule", required: true },
              ]}
            />
          </>
        }
      />
      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        searchKeys={["booking_id", "shipment_id", "driverName"]}
        columns={[
          { key: "booking_id", label: "Booking", link: "href" },
          ...(isSuperAdmin
            ? [
                {
                  key: "merchant.name",
                  label: "Merchant",
                  link: "merchantHref",
                },
              ]
            : []),
          { key: "shipment_id", label: "Shipment" },
          {
            key: "status",
            label: "Status",
            type: "status",
          },
          { key: "driverNameDisplay", label: "Driver" },
          { key: "scheduledAt", label: "Scheduled" },
        ]}
        rowActions={[
          { label: "View", hrefKey: "href" },
          { label: "Assign driver" },
          { label: "Cancel", variant: "destructive" },
        ]}
        enableSorting
        sortableColumns={["booking_id", "shipment_id", "status", "scheduledAt"]}
        sortKeyMap={{ booking_id: "uuid", scheduledAt: "booked_at" }}
      />
    </div>
  )
}
