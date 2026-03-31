import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { ShipmentsByLocationChart } from "@/components/reports/shipments-by-location-chart"
import { ShipmentsByLocationControls } from "@/components/reports/shipments-by-location-controls"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getShipmentsByLocationReport, type ShipmentsByLocationReportParams } from "@/lib/api/reports"
import { AdminLinks, withAdminQuery } from "@/lib/routes/admin"
import { isApiErrorResponse } from "@/lib/api/client"
import { requireAuth } from "@/lib/auth"

type PageProps = {
  searchParams?: Promise<{
    date_range?: string
    location_type?: string
    start_date?: string
    end_date?: string
  }>
}

const DATE_RANGES = [
  "today",
  "yesterday",
  "thisweek",
  "1week",
  "2weeks",
  "30days",
  "1month",
  "3months",
  "6months",
  "1year",
  "alltime",
  "custom",
] as const satisfies readonly NonNullable<ShipmentsByLocationReportParams["date_range"]>[]

function normalizeDateRange(
  value?: string
): NonNullable<ShipmentsByLocationReportParams["date_range"]> {
  return value && DATE_RANGES.includes(value as (typeof DATE_RANGES)[number])
    ? (value as (typeof DATE_RANGES)[number])
    : "1month"
}

function normalizeLocationType(value?: string): "pickup" | "dropoff" {
  return value === "dropoff" ? "dropoff" : "pickup"
}

function normalizeDateParam(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

function formatDate(value: Date) {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, "0")
  const day = `${value.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function resolveCreatedRange(
  dateRange: NonNullable<ShipmentsByLocationReportParams["date_range"]>,
  startDate?: string,
  endDate?: string
) {
  if (dateRange === "custom") {
    return {
      created_from: startDate,
      created_to: endDate,
    }
  }

  const today = new Date()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const start = new Date(end)

  switch (dateRange) {
    case "today":
      break
    case "yesterday":
      start.setDate(start.getDate() - 1)
      end.setDate(end.getDate() - 1)
      break
    case "thisweek":
      start.setDate(start.getDate() - start.getDay())
      break
    case "1week":
      start.setDate(start.getDate() - 6)
      break
    case "2weeks":
      start.setDate(start.getDate() - 13)
      break
    case "30days":
      start.setDate(start.getDate() - 29)
      break
    case "1month":
      start.setMonth(start.getMonth() - 1)
      break
    case "3months":
      start.setMonth(start.getMonth() - 3)
      break
    case "6months":
      start.setMonth(start.getMonth() - 6)
      break
    case "1year":
      start.setFullYear(start.getFullYear() - 1)
      break
    case "alltime":
      return { created_from: undefined, created_to: undefined }
  }

  return {
    created_from: formatDate(start),
    created_to: formatDate(end),
  }
}

export default async function ShipmentsByLocationPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {}
  const dateRange = normalizeDateRange(params.date_range)
  const locationType = normalizeLocationType(params.location_type)
  const startDate = normalizeDateParam(params.start_date)
  const endDate = normalizeDateParam(params.end_date)
  const customRangeIncomplete = dateRange === "custom" && (!startDate || !endDate)

  const session = await requireAuth()
  const merchantId = session.selected_merchant?.merchant_id ?? undefined

  const response = customRangeIncomplete
    ? null
    : await getShipmentsByLocationReport(
        {
          merchant_id: merchantId,
          date_range: dateRange,
          location_type: locationType,
          start_date: startDate,
          end_date: endDate,
        },
        session.accessToken
      )

  const rows = response && !isApiErrorResponse(response) ? response.data ?? [] : []
  const meta = response && !isApiErrorResponse(response) ? response.meta : undefined
  const createdRange = resolveCreatedRange(dateRange, startDate, endDate)
  const linkedRows = rows.map((row) => ({
    ...row,
    cityLabel: row.city ?? "-",
    href: row.location_id
      ? withAdminQuery(AdminLinks.reportsShipments, {
          [locationType === "pickup" ? "from_location_id" : "to_location_id"]: row.location_id,
          created_from: createdRange.created_from,
          created_to: createdRange.created_to,
        })
      : undefined,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipments by Location"
        description="Compare shipment volume by pickup and dropoff location over a selected date range."
        actions={
          <ShipmentsByLocationControls
            dateRange={dateRange}
            locationType={locationType}
            startDate={startDate}
            endDate={endDate}
          />
        }
      />

      {customRangeIncomplete ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Select both a start date and end date to load a custom shipment range.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Location groups</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{meta?.total_locations ?? rows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total shipments</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{meta?.total_shipments ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Grouping</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold capitalize">{locationType}</CardContent>
        </Card>
      </div>

      <ShipmentsByLocationChart rows={linkedRows} locationType={locationType} />

      <Card>
        <CardHeader>
          <CardTitle>Location totals</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={linkedRows}
            emptyMessage="No shipment totals found for the selected range."
            columns={[
              { key: "location_name", label: "Location name", link: "href" },
              { key: "cityLabel", label: "City" },
              { key: "total_shipments", label: "Total shipments", className: "text-left" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
