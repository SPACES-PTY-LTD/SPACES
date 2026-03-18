import { PageHeader } from "@/components/layout/page-header"
import { DataTable } from "@/components/common/data-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isApiErrorResponse } from "@/lib/api/client"
import { listVehicleActivities } from "@/lib/api/vehicle-activities"
import type { VehicleActivity } from "@/lib/types"
import { requireAuth } from "@/lib/auth"
import { AdminRoute } from "@/lib/routes/admin"

type StopAnalysisRow = {
  key: string
  locationId?: string
  locationName: string
  visitCount: number
  uniqueVehicleCount: number
  averageDwellMinutes: number | null
  maxDwellMinutes: number | null
  openVisits: number
  latestVisitAt: string | null
}

type SortBy =
  | "stop"
  | "visits"
  | "vehicles"
  | "avg_dwell"
  | "max_dwell"
  | "open_visits"
  | "latest_visit"

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : (value ?? "")
}

function normalizeSortBy(value: string): SortBy {
  const allowed = new Set<SortBy>([
    "stop",
    "visits",
    "vehicles",
    "avg_dwell",
    "max_dwell",
    "open_visits",
    "latest_visit",
  ])
  return allowed.has(value as SortBy) ? (value as SortBy) : "visits"
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

function locationLabel(activity: VehicleActivity): string {
  return (
    activity.location?.name ??
    activity.location?.company ??
    activity.location?.code ??
    activity.location?.location_id ??
    "Unknown location"
  )
}

async function fetchEnteredLocationActivities(token: string, merchantId?: string): Promise<VehicleActivity[]> {
  const rows: VehicleActivity[] = []
  const maxPages = 10

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await listVehicleActivities(token, {
      page,
      per_page: 100,
      merchant_id: merchantId,
      event_type: "entered_location",
    })

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

function buildStopAnalysisRows(rows: VehicleActivity[]): StopAnalysisRow[] {
  const grouped = new Map<string, {
    locationId?: string
    locationName: string
    visitCount: number
    vehicles: Set<string>
    dwellTotal: number
    dwellCount: number
    maxDwell: number | null
    openVisits: number
    latestVisitAt: string | null
  }>()

  for (const activity of rows) {
    const locationId = activity.location?.location_id ?? activity.location_id ?? undefined
    const key = locationId ?? locationLabel(activity)
    const current = grouped.get(key) ?? {
      locationId,
      locationName: locationLabel(activity),
      visitCount: 0,
      vehicles: new Set<string>(),
      dwellTotal: 0,
      dwellCount: 0,
      maxDwell: null,
      openVisits: 0,
      latestVisitAt: null,
    }

    current.visitCount += 1
    const vehicleId = activity.vehicle?.vehicle_id ?? activity.vehicle_id ?? undefined
    if (vehicleId) {
      current.vehicles.add(vehicleId)
    }

    const dwell = minutesBetween(activity.entered_at, activity.exited_at)
    if (dwell !== null) {
      current.dwellTotal += dwell
      current.dwellCount += 1
      current.maxDwell = current.maxDwell === null ? dwell : Math.max(current.maxDwell, dwell)
    } else {
      current.openVisits += 1
    }

    const lastVisit = activity.exited_at ?? activity.entered_at ?? activity.occurred_at ?? null
    if (!current.latestVisitAt || (parseDate(lastVisit)?.getTime() ?? 0) > (parseDate(current.latestVisitAt)?.getTime() ?? 0)) {
      current.latestVisitAt = lastVisit
    }

    grouped.set(key, current)
  }

  return Array.from(grouped.entries())
    .map(([key, value]) => ({
      key,
      locationId: value.locationId,
      locationName: value.locationName,
      visitCount: value.visitCount,
      uniqueVehicleCount: value.vehicles.size,
      averageDwellMinutes: value.dwellCount > 0 ? value.dwellTotal / value.dwellCount : null,
      maxDwellMinutes: value.maxDwell,
      openVisits: value.openVisits,
      latestVisitAt: value.latestVisitAt,
    }))
}

function sortStopAnalysisRows(
  rows: StopAnalysisRow[],
  sortBy: SortBy,
  sortDir: "asc" | "desc"
): StopAnalysisRow[] {
  const direction = sortDir === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    let aValue: number | string = ""
    let bValue: number | string = ""

    switch (sortBy) {
      case "stop":
        aValue = a.locationName
        bValue = b.locationName
        break
      case "visits":
        aValue = a.visitCount
        bValue = b.visitCount
        break
      case "vehicles":
        aValue = a.uniqueVehicleCount
        bValue = b.uniqueVehicleCount
        break
      case "avg_dwell":
        aValue = a.averageDwellMinutes ?? -1
        bValue = b.averageDwellMinutes ?? -1
        break
      case "max_dwell":
        aValue = a.maxDwellMinutes ?? -1
        bValue = b.maxDwellMinutes ?? -1
        break
      case "open_visits":
        aValue = a.openVisits
        bValue = b.openVisits
        break
      case "latest_visit":
        aValue = parseDate(a.latestVisitAt)?.getTime() ?? 0
        bValue = parseDate(b.latestVisitAt)?.getTime() ?? 0
        break
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      return aValue.localeCompare(bValue) * direction
    }

    return ((aValue as number) - (bValue as number)) * direction
  })
}

export default async function StopsAnalysisPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const sortBy = normalizeSortBy(getSingleValue(params.sort_by))
  const sortDir = normalizeSortDir(getSingleValue(params.sort_dir))
  const session = await requireAuth()
  const merchantId = session.selected_merchant?.merchant_id ?? undefined
  const activities = await fetchEnteredLocationActivities(session.accessToken, merchantId)
  const rows = sortStopAnalysisRows(buildStopAnalysisRows(activities), sortBy, sortDir)
  const tableRows = rows.map((row) => ({
    ...row,
    stopHref: row.locationId ? AdminRoute.locationDetails(row.locationId) : "",
    averageDwellDisplay: formatMinutes(row.averageDwellMinutes),
    maxDwellDisplay: formatMinutes(row.maxDwellMinutes),
    latestVisitDisplay: formatDateTime(row.latestVisitAt),
  }))

  const totalVisits = rows.reduce((sum, row) => sum + row.visitCount, 0)
  const avgDwellAcrossStops =
    rows.filter((row) => row.averageDwellMinutes !== null).length > 0
      ? rows.reduce((sum, row) => sum + (row.averageDwellMinutes ?? 0), 0) /
        rows.filter((row) => row.averageDwellMinutes !== null).length
      : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stops Analysis"
        description="Visit and dwell-time analysis for geofenced stops."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Stops analyzed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{rows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total visits</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalVisits}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg dwell per stop</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMinutes(avgDwellAcrossStops)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stop Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={tableRows}
            emptyMessage="No stop activity data found."
            enableSorting
            sortableColumns={[
              "locationName",
              "visitCount",
              "uniqueVehicleCount",
              "averageDwellDisplay",
              "maxDwellDisplay",
              "openVisits",
              "latestVisitDisplay",
            ]}
            sortKeyMap={{
              locationName: "stop",
              visitCount: "visits",
              uniqueVehicleCount: "vehicles",
              averageDwellDisplay: "avg_dwell",
              maxDwellDisplay: "max_dwell",
              openVisits: "open_visits",
              latestVisitDisplay: "latest_visit",
            }}
            columns={[
              { key: "locationName", label: "Stop", link: "stopHref" },
              { key: "visitCount", label: "Visits" },
              { key: "uniqueVehicleCount", label: "Unique vehicles" },
              { key: "averageDwellDisplay", label: "Avg dwell" },
              { key: "maxDwellDisplay", label: "Max dwell" },
              { key: "openVisits", label: "Open visits" },
              { key: "latestVisitDisplay", label: "Latest visit" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
