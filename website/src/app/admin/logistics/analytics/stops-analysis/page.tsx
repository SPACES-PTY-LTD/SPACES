import { buildStopAnalysisDetails, buildStopAnalysisRows, type StopAnalysisRow } from "@/components/reports/stops-analysis-visits"
import { format, isValid, parseISO } from "date-fns"
import { StopsAnalysisDateFilter } from "@/components/reports/stops-analysis-date-filter"
import { normalizeStopAnalysisPeriod, stopAnalysisPeriodBounds, stopAnalysisPeriods } from "@/components/reports/stops-analysis-period"
import { PageHeader } from "@/components/layout/page-header"
import { StopsAnalysisTable } from "@/components/reports/stops-analysis-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isApiErrorResponse } from "@/lib/api/client"
import { listVehicleActivities } from "@/lib/api/vehicle-activities"
import type { VehicleActivity } from "@/lib/types"
import { requireAuth } from "@/lib/auth"
import { AdminRoute } from "@/lib/routes/admin"

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

function normalizeDateFilter(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const parsed = parseISO(value)
  return isValid(parsed) && format(parsed, "yyyy-MM-dd") === value ? value : undefined
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

async function fetchEnteredLocationActivities(token: string, merchantId?: string, from?: string, to?: string, timestampBounds: { occurred_from?: string; occurred_to?: string } = {}): Promise<VehicleActivity[]> {
  const rows: VehicleActivity[] = []
  const maxPages = 10

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await listVehicleActivities(token, {
      page,
      per_page: 100,
      merchant_id: merchantId,
      event_type: "entered_location",
      from,
      to,
      ...timestampBounds,
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
  let from = normalizeDateFilter(getSingleValue(params.from))
  let to = normalizeDateFilter(getSingleValue(params.to))
  if (from && to && from > to) [from, to] = [to, from]
  const period = normalizeStopAnalysisPeriod(getSingleValue(params.period), Boolean(from || to))
  const session = await requireAuth()
  const merchantId = session.selected_merchant?.merchant_id ?? undefined
  const timestampBounds = stopAnalysisPeriodBounds(period, new Date())
  const periodLabel = stopAnalysisPeriods.find(item => item.value === period)!.label
  const rangeLabel = period === "custom"
    ? `Custom: ${from ?? "All earlier dates"} – ${to ?? "All later dates"}`
    : `${periodLabel}: ${formatDateTime(timestampBounds.occurred_from)} – ${formatDateTime(timestampBounds.occurred_to)}`
  const activities = await fetchEnteredLocationActivities(
    session.accessToken, merchantId,
    period === "custom" ? from : undefined,
    period === "custom" ? to : undefined,
    timestampBounds
  )
  const rows = sortStopAnalysisRows(buildStopAnalysisRows(activities), sortBy, sortDir)
  const details = buildStopAnalysisDetails(activities)
  const tableRows = rows.map((row) => ({
    ...row,
    stopHref: row.locationId ? AdminRoute.locationDetails(row.locationId) : "",
    vehicles: details[row.key]?.vehicles ?? [],
    visits: (details[row.key]?.visits ?? []).map(visit => ({
      ...visit, entryDisplay: formatDateTime(visit.enteredAt), exitDisplay: formatDateTime(visit.exitedAt),
    })),
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
        actions={<StopsAnalysisDateFilter period={period} from={from} to={to} />}
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
          <StopsAnalysisTable rows={tableRows} rangeLabel={rangeLabel} />
        </CardContent>
      </Card>
    </div>
  )
}
