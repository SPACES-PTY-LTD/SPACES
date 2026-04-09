import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { RouteWaitingTimesControls } from "@/components/reports/route-waiting-times-controls"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getRouteWaitingTimesReport,
  type RouteWaitingTimesReportParams,
  type RouteWaitingTimesReportRow,
} from "@/lib/api/reports"
import { isApiErrorResponse } from "@/lib/api/client"
import { requireAuth } from "@/lib/auth"
import { AdminLinks, withAdminQuery } from "@/lib/routes/admin"

type SortBy =
  | "combined_wait"
  | "route"
  | "shipments"
  | "avg_pickup_wait"
  | "avg_dropoff_wait"
  | "avg_transit"
  | "latest_activity"

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
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
] as const satisfies readonly NonNullable<RouteWaitingTimesReportParams["date_range"]>[]

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : (value ?? "")
}

function normalizeSortBy(value: string): SortBy {
  const allowed = new Set<SortBy>([
    "combined_wait",
    "route",
    "shipments",
    "avg_pickup_wait",
    "avg_dropoff_wait",
    "avg_transit",
    "latest_activity",
  ])

  return allowed.has(value as SortBy) ? (value as SortBy) : "combined_wait"
}

function normalizeSortDir(value: string): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc"
}

function normalizeDateRange(
  value?: string
): NonNullable<RouteWaitingTimesReportParams["date_range"]> {
  return value && DATE_RANGES.includes(value as (typeof DATE_RANGES)[number])
    ? (value as (typeof DATE_RANGES)[number])
    : "1month"
}

function normalizeDateParam(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: Date) {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, "0")
  const day = `${value.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function resolveCreatedRange(
  dateRange: NonNullable<RouteWaitingTimesReportParams["date_range"]>,
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

function formatMinutes(value: number | null): string {
  if (value === null) return "-"
  return `${value.toFixed(1)} min`
}

function formatDateTime(value?: string | null): string {
  const date = parseDate(value)
  if (!date) return "-"
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function average(total: number, count: number): number | null {
  if (count <= 0) return null
  return total / count
}

function sortRouteWaitingRows(
  rows: RouteWaitingTimesReportRow[],
  sortBy: SortBy,
  sortDir: "asc" | "desc"
): RouteWaitingTimesReportRow[] {
  const direction = sortDir === "asc" ? 1 : -1

  return [...rows].sort((a, b) => {
    let aValue: number | string = ""
    let bValue: number | string = ""

    switch (sortBy) {
      case "combined_wait":
        aValue = (a.avg_pickup_wait_minutes ?? 0) + (a.avg_dropoff_wait_minutes ?? 0)
        bValue = (b.avg_pickup_wait_minutes ?? 0) + (b.avg_dropoff_wait_minutes ?? 0)
        break
      case "route":
        aValue = a.route_label
        bValue = b.route_label
        break
      case "shipments":
        aValue = a.shipment_count
        bValue = b.shipment_count
        break
      case "avg_pickup_wait":
        aValue = a.avg_pickup_wait_minutes ?? -1
        bValue = b.avg_pickup_wait_minutes ?? -1
        break
      case "avg_dropoff_wait":
        aValue = a.avg_dropoff_wait_minutes ?? -1
        bValue = b.avg_dropoff_wait_minutes ?? -1
        break
      case "avg_transit":
        aValue = a.avg_transit_minutes ?? -1
        bValue = b.avg_transit_minutes ?? -1
        break
      case "latest_activity":
        aValue = parseDate(a.latest_activity_at)?.getTime() ?? 0
        bValue = parseDate(b.latest_activity_at)?.getTime() ?? 0
        break
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      return aValue.localeCompare(bValue) * direction
    }

    return ((aValue as number) - (bValue as number)) * direction
  })
}

export default async function RouteWaitingTimesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {}
  const sortBy = normalizeSortBy(getSingleValue(params.sort_by))
  const sortDir = normalizeSortDir(getSingleValue(params.sort_dir))
  const dateRange = normalizeDateRange(getSingleValue(params.date_range))
  const startDate = normalizeDateParam(getSingleValue(params.start_date))
  const endDate = normalizeDateParam(getSingleValue(params.end_date))
  const customRangeIncomplete = dateRange === "custom" && (!startDate || !endDate)

  const session = await requireAuth()
  const merchantId = session.selected_merchant?.merchant_id ?? undefined

  const response = customRangeIncomplete
    ? null
    : await getRouteWaitingTimesReport(
        {
          merchant_id: merchantId,
          date_range: dateRange,
          start_date: startDate,
          end_date: endDate,
        },
        session.accessToken
      )

  const routeRows =
    response && !isApiErrorResponse(response)
      ? sortRouteWaitingRows(response.data ?? [], sortBy, sortDir)
      : []

  const createdRange = resolveCreatedRange(dateRange, startDate, endDate)
  const tableRows = routeRows.map((row) => ({
    ...row,
    routeHref: withAdminQuery(AdminLinks.reportsShipments, {
      from_location_id: row.from_location_id,
      to_location_id: row.to_location_id,
      created_from: createdRange.created_from,
      created_to: createdRange.created_to,
    }),
    routeLabel: row.route_label,
    shipmentCount: row.shipment_count,
    avgPickupWaitDisplay: formatMinutes(row.avg_pickup_wait_minutes),
    avgDropoffWaitDisplay: formatMinutes(row.avg_dropoff_wait_minutes),
    avgTransitDisplay: formatMinutes(row.avg_transit_minutes),
    latestActivityDisplay: formatDateTime(row.latest_activity_at),
  }))

  const avgPickup = average(
    routeRows.reduce((sum, row) => sum + (row.avg_pickup_wait_minutes ?? 0), 0),
    routeRows.filter((row) => row.avg_pickup_wait_minutes !== null).length
  )
  const avgDropoff = average(
    routeRows.reduce((sum, row) => sum + (row.avg_dropoff_wait_minutes ?? 0), 0),
    routeRows.filter((row) => row.avg_dropoff_wait_minutes !== null).length
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Route Waiting Times"
        description="Average waiting and transit time per route based on shipment stage timestamps."
        actions={
          <RouteWaitingTimesControls
            dateRange={dateRange}
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
            <CardTitle className="text-sm text-muted-foreground">Routes analyzed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{routeRows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg pickup wait</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMinutes(avgPickup)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg dropoff wait</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMinutes(avgDropoff)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Route Wait Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={tableRows}
            emptyMessage="No route waiting data found."
            enableSorting
            sortableColumns={[
              "routeLabel",
              "shipmentCount",
              "avgPickupWaitDisplay",
              "avgDropoffWaitDisplay",
              "avgTransitDisplay",
              "latestActivityDisplay",
            ]}
            sortKeyMap={{
              routeLabel: "route",
              shipmentCount: "shipments",
              avgPickupWaitDisplay: "avg_pickup_wait",
              avgDropoffWaitDisplay: "avg_dropoff_wait",
              avgTransitDisplay: "avg_transit",
              latestActivityDisplay: "latest_activity",
            }}
            columns={[
              { key: "routeLabel", label: "Route", link: "routeHref" },
              { key: "shipmentCount", label: "Shipments" },
              { key: "avgPickupWaitDisplay", label: "Avg pickup wait" },
              { key: "avgDropoffWaitDisplay", label: "Avg dropoff wait" },
              { key: "avgTransitDisplay", label: "Avg transit" },
              { key: "latestActivityDisplay", label: "Latest activity" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
