import { PageHeader } from "@/components/layout/page-header"
import { DataTable } from "@/components/common/data-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isApiErrorResponse } from "@/lib/api/client"
import { getShipmentsFullReport, type ShipmentFullReportRow } from "@/lib/api/reports"
import { requireAuth } from "@/lib/auth"
import { AdminLinks, withAdminQuery } from "@/lib/routes/admin"

type RouteWaitingRow = {
  routeKey: string
  routeLabel: string
  shipmentCount: number
  avgPickupWaitMinutes: number | null
  avgDropoffWaitMinutes: number | null
  avgTransitMinutes: number | null
  latestActivityAt: string | null
  fromLocationId?: string
  toLocationId?: string
}

type SortBy =
  | "combined_wait"
  | "route"
  | "shipments"
  | "avg_pickup_wait"
  | "avg_dropoff_wait"
  | "avg_transit"
  | "latest_activity"

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

function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function minutesBetween(start?: string | null, end?: string | null): number | null {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  if (!startDate || !endDate) return null
  const diff = (endDate.getTime() - startDate.getTime()) / 60000
  return diff >= 0 ? diff : null
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

function locationLabel(location?: { name?: string | null; code?: string | null; location_id?: string } | null): string {
  return location?.name ?? location?.code ?? location?.location_id ?? "Unknown"
}

async function fetchShipmentRows(token: string, merchantId?: string): Promise<ShipmentFullReportRow[]> {
  const rows: ShipmentFullReportRow[] = []
  const maxPages = 10

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await getShipmentsFullReport(
      {
        merchant_id: merchantId,
        page,
        per_page: 200,
        sort_by: "date_created",
        sort_direction: "desc",
      },
      token
    )

    if (isApiErrorResponse(response)) {
      break
    }

    rows.push(...(response.data ?? []))

    const currentPage = Number(response.meta?.current_page ?? page)
    const lastPage = Number(response.meta?.last_page ?? page)
    if (currentPage >= lastPage) {
      break
    }
  }

  return rows
}

function buildRouteWaitingRows(rows: ShipmentFullReportRow[]): RouteWaitingRow[] {
  const grouped = new Map<string, {
    routeLabel: string
    shipmentCount: number
    pickupWaitTotal: number
    pickupWaitCount: number
    dropoffWaitTotal: number
    dropoffWaitCount: number
    transitTotal: number
    transitCount: number
    latestActivityAt: string | null
    fromLocationId?: string
    toLocationId?: string
  }>()

  for (const row of rows) {
    if (!row.from_location && !row.to_location) continue

    const fromId = row.from_location?.location_id
    const toId = row.to_location?.location_id
    const key = `${fromId ?? row.from_location?.name ?? "unknown-from"}::${toId ?? row.to_location?.name ?? "unknown-to"}`
    const pickupWait = minutesBetween(row.from_time_in, row.from_time_out)
    const dropoffWait = minutesBetween(row.to_time_in, row.to_time_out)
    const transit = minutesBetween(row.from_time_out, row.to_time_in)
    const latestAt = row.to_time_out ?? row.to_time_in ?? row.from_time_out ?? row.from_time_in ?? row.date_created ?? null

    const current = grouped.get(key) ?? {
      routeLabel: `${locationLabel(row.from_location)} -> ${locationLabel(row.to_location)}`,
      shipmentCount: 0,
      pickupWaitTotal: 0,
      pickupWaitCount: 0,
      dropoffWaitTotal: 0,
      dropoffWaitCount: 0,
      transitTotal: 0,
      transitCount: 0,
      latestActivityAt: null,
      fromLocationId: fromId,
      toLocationId: toId,
    }

    current.shipmentCount += 1
    if (pickupWait !== null) {
      current.pickupWaitTotal += pickupWait
      current.pickupWaitCount += 1
    }
    if (dropoffWait !== null) {
      current.dropoffWaitTotal += dropoffWait
      current.dropoffWaitCount += 1
    }
    if (transit !== null) {
      current.transitTotal += transit
      current.transitCount += 1
    }
    if (!current.latestActivityAt || (parseDate(latestAt)?.getTime() ?? 0) > (parseDate(current.latestActivityAt)?.getTime() ?? 0)) {
      current.latestActivityAt = latestAt
    }

    grouped.set(key, current)
  }

  return Array.from(grouped.entries())
    .map(([routeKey, value]) => ({
      routeKey,
      routeLabel: value.routeLabel,
      shipmentCount: value.shipmentCount,
      avgPickupWaitMinutes: average(value.pickupWaitTotal, value.pickupWaitCount),
      avgDropoffWaitMinutes: average(value.dropoffWaitTotal, value.dropoffWaitCount),
      avgTransitMinutes: average(value.transitTotal, value.transitCount),
      latestActivityAt: value.latestActivityAt,
      fromLocationId: value.fromLocationId,
      toLocationId: value.toLocationId,
    }))
}

function sortRouteWaitingRows(
  rows: RouteWaitingRow[],
  sortBy: SortBy,
  sortDir: "asc" | "desc"
): RouteWaitingRow[] {
  const direction = sortDir === "asc" ? 1 : -1
  const sorted = [...rows].sort((a, b) => {
    let aValue: number | string = ""
    let bValue: number | string = ""

    switch (sortBy) {
      case "combined_wait":
        aValue = (a.avgPickupWaitMinutes ?? 0) + (a.avgDropoffWaitMinutes ?? 0)
        bValue = (b.avgPickupWaitMinutes ?? 0) + (b.avgDropoffWaitMinutes ?? 0)
        break
      case "route":
        aValue = a.routeLabel
        bValue = b.routeLabel
        break
      case "shipments":
        aValue = a.shipmentCount
        bValue = b.shipmentCount
        break
      case "avg_pickup_wait":
        aValue = a.avgPickupWaitMinutes ?? -1
        bValue = b.avgPickupWaitMinutes ?? -1
        break
      case "avg_dropoff_wait":
        aValue = a.avgDropoffWaitMinutes ?? -1
        bValue = b.avgDropoffWaitMinutes ?? -1
        break
      case "avg_transit":
        aValue = a.avgTransitMinutes ?? -1
        bValue = b.avgTransitMinutes ?? -1
        break
      case "latest_activity":
        aValue = parseDate(a.latestActivityAt)?.getTime() ?? 0
        bValue = parseDate(b.latestActivityAt)?.getTime() ?? 0
        break
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      return aValue.localeCompare(bValue) * direction
    }

    return ((aValue as number) - (bValue as number)) * direction
  })

  return sorted
}

export default async function RouteWaitingTimesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const sortBy = normalizeSortBy(getSingleValue(params.sort_by))
  const sortDir = normalizeSortDir(getSingleValue(params.sort_dir))
  const session = await requireAuth()
  const merchantId = session.selected_merchant?.merchant_id ?? undefined
  const shipmentRows = await fetchShipmentRows(session.accessToken, merchantId)
  const routeRows = sortRouteWaitingRows(buildRouteWaitingRows(shipmentRows), sortBy, sortDir)
  const tableRows = routeRows.map((row) => ({
    ...row,
    routeHref: withAdminQuery(AdminLinks.reportsShipments, {
      from_location_id: row.fromLocationId,
      to_location_id: row.toLocationId,
    }),
    avgPickupWaitDisplay: formatMinutes(row.avgPickupWaitMinutes),
    avgDropoffWaitDisplay: formatMinutes(row.avgDropoffWaitMinutes),
    avgTransitDisplay: formatMinutes(row.avgTransitMinutes),
    latestActivityDisplay: formatDateTime(row.latestActivityAt),
  }))

  const avgPickup = average(
    routeRows.reduce((sum, row) => sum + (row.avgPickupWaitMinutes ?? 0), 0),
    routeRows.filter((row) => row.avgPickupWaitMinutes !== null).length
  )
  const avgDropoff = average(
    routeRows.reduce((sum, row) => sum + (row.avgDropoffWaitMinutes ?? 0), 0),
    routeRows.filter((row) => row.avgDropoffWaitMinutes !== null).length
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Route Waiting Times"
        description="Average waiting and transit time per route based on shipment stage timestamps."
      />

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
