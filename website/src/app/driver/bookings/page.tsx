import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { isApiErrorResponse } from "@/lib/api/client"
import { listDriverBookings } from "@/lib/api/driver"
import { requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

type DriverBookingsPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
  }>
}

export default async function DriverBookingsPage({
  searchParams,
}: DriverBookingsPageProps) {
  const params = (await searchParams) ?? {}
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const session = await requireAuth()
  const response = await listDriverBookings(session.accessToken, { page })
  const isError = isApiErrorResponse(response)
  const loading_error = isError ? response.message : null
  const rows = isError
    ? []
    : response.data.map((booking) => ({
        ...booking,
        href: `/driver/bookings/${booking.booking_id}`,
      }))
  const tableMeta = isError ? undefined : normalizeTableMeta(response.meta)

  return (
    <div className="space-y-6">
      <PageHeader
        title="My bookings"
        description="Track assigned pickups, scans, and proof of delivery."
      />
      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        searchKeys={["booking_id", "shipment_id"]}
        columns={[
          { key: "booking_id", label: "Booking" },
          { key: "shipment_id", label: "Shipment" },
          {
            key: "status",
            label: "Status",
            type: "status",
          },
          { key: "scheduledAt", label: "Scheduled" },
        ]}
        rowActions={[
          { label: "View", hrefKey: "href" },
        ]}
      />
    </div>
  )
}
