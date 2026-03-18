import { PageHeader } from "@/components/layout/page-header"
import { DataTable } from "@/components/common/data-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isApiErrorResponse } from "@/lib/api/client"
import { listVehicleActivities } from "@/lib/api/vehicle-activities"
import type { VehicleActivity } from "@/lib/types"
import { requireAuth } from "@/lib/auth"
import { AdminRoute } from "@/lib/routes/admin"

type DriverSpeedingRow = {
  key: string
  driverId?: string
  driverName: string
  speedingEvents: number
  highestSpeedKph: number | null
  averageOverLimitKph: number | null
  uniqueVehicleCount: number
  latestEventAt: string | null
}

type SortBy =
  | "events"
  | "driver"
  | "highest_speed"
  | "avg_over_limit"
  | "vehicles"
  | "latest_event"

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : (value ?? "")
}

function normalizeSortBy(value: string): SortBy {
  const allowed = new Set<SortBy>([
    "events",
    "driver",
    "highest_speed",
    "avg_over_limit",
    "vehicles",
    "latest_event",
  ])
  return allowed.has(value as SortBy) ? (value as SortBy) : "events"
}

function normalizeSortDir(value: string): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc"
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
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

function formatKph(value: number | null): string {
  if (value === null) return "-"
  return `${value.toFixed(1)} km/h`
}

function resolveDriver(activity: VehicleActivity): { key: string; driverId?: string; name: string } {
  const driverId = activity.driver?.driver_id ?? activity.vehicle?.last_driver?.driver_id
  const driverName = activity.driver?.name ?? activity.vehicle?.last_driver?.name
  const vehicleRef = activity.vehicle?.plate_number ?? activity.vehicle?.vehicle_id ?? activity.vehicle_id

  if (driverId) {
    return {
      key: driverId,
      driverId,
      name: driverName ?? "Unnamed driver",
    }
  }

  return {
    key: `vehicle:${vehicleRef ?? "unknown"}`,
    name: `Unassigned (${vehicleRef ?? "Unknown vehicle"})`,
  }
}

async function fetchSpeedingActivities(token: string, merchantId?: string): Promise<VehicleActivity[]> {
  const rows: VehicleActivity[] = []
  const maxPages = 10

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await listVehicleActivities(token, {
      page,
      per_page: 100,
      merchant_id: merchantId,
      event_type: "speeding",
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

function buildDriverSpeedingRows(rows: VehicleActivity[]): DriverSpeedingRow[] {
  const grouped = new Map<string, {
    driverId?: string
    driverName: string
    speedingEvents: number
    highestSpeedKph: number | null
    overLimitTotal: number
    overLimitCount: number
    vehicles: Set<string>
    latestEventAt: string | null
  }>()

  for (const activity of rows) {
    const driver = resolveDriver(activity)
    const current = grouped.get(driver.key) ?? {
      driverId: driver.driverId,
      driverName: driver.name,
      speedingEvents: 0,
      highestSpeedKph: null,
      overLimitTotal: 0,
      overLimitCount: 0,
      vehicles: new Set<string>(),
      latestEventAt: null,
    }

    current.speedingEvents += 1

    const speed = typeof activity.speed_kph === "number" ? activity.speed_kph : null
    const speedLimit = typeof activity.speed_limit_kph === "number" ? activity.speed_limit_kph : null
    if (speed !== null) {
      current.highestSpeedKph = current.highestSpeedKph === null ? speed : Math.max(current.highestSpeedKph, speed)
    }
    if (speed !== null && speedLimit !== null) {
      const over = speed - speedLimit
      if (over > 0) {
        current.overLimitTotal += over
        current.overLimitCount += 1
      }
    }

    const vehicleId = activity.vehicle?.vehicle_id ?? activity.vehicle_id
    if (vehicleId) {
      current.vehicles.add(vehicleId)
    }

    const eventAt = activity.occurred_at ?? activity.created_at ?? null
    if (!current.latestEventAt || (parseDate(eventAt)?.getTime() ?? 0) > (parseDate(current.latestEventAt)?.getTime() ?? 0)) {
      current.latestEventAt = eventAt
    }

    grouped.set(driver.key, current)
  }

  return Array.from(grouped.entries())
    .map(([key, value]) => ({
      key,
      driverId: value.driverId,
      driverName: value.driverName,
      speedingEvents: value.speedingEvents,
      highestSpeedKph: value.highestSpeedKph,
      averageOverLimitKph: value.overLimitCount > 0 ? value.overLimitTotal / value.overLimitCount : null,
      uniqueVehicleCount: value.vehicles.size,
      latestEventAt: value.latestEventAt,
    }))
}

function sortDriverSpeedingRows(
  rows: DriverSpeedingRow[],
  sortBy: SortBy,
  sortDir: "asc" | "desc"
): DriverSpeedingRow[] {
  const direction = sortDir === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    let aValue: number | string = ""
    let bValue: number | string = ""

    switch (sortBy) {
      case "events":
        aValue = a.speedingEvents
        bValue = b.speedingEvents
        break
      case "driver":
        aValue = a.driverName
        bValue = b.driverName
        break
      case "highest_speed":
        aValue = a.highestSpeedKph ?? -1
        bValue = b.highestSpeedKph ?? -1
        break
      case "avg_over_limit":
        aValue = a.averageOverLimitKph ?? -1
        bValue = b.averageOverLimitKph ?? -1
        break
      case "vehicles":
        aValue = a.uniqueVehicleCount
        bValue = b.uniqueVehicleCount
        break
      case "latest_event":
        aValue = parseDate(a.latestEventAt)?.getTime() ?? 0
        bValue = parseDate(b.latestEventAt)?.getTime() ?? 0
        break
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      return aValue.localeCompare(bValue) * direction
    }

    return ((aValue as number) - (bValue as number)) * direction
  })
}

export default async function DriversSpeedingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const sortBy = normalizeSortBy(getSingleValue(params.sort_by))
  const sortDir = normalizeSortDir(getSingleValue(params.sort_dir))
  const session = await requireAuth()
  const merchantId = session.selected_merchant?.merchant_id ?? undefined
  const activities = await fetchSpeedingActivities(session.accessToken, merchantId)
  const rows = sortDriverSpeedingRows(buildDriverSpeedingRows(activities), sortBy, sortDir)
  const tableRows = rows.map((row) => ({
    ...row,
    driverHref: row.driverId ? AdminRoute.driverDetails(row.driverId) : "",
    highestSpeedDisplay: formatKph(row.highestSpeedKph),
    averageOverLimitDisplay: formatKph(row.averageOverLimitKph),
    latestEventDisplay: formatDateTime(row.latestEventAt),
  }))

  const totalEvents = rows.reduce((sum, row) => sum + row.speedingEvents, 0)
  const avgOverLimit =
    rows.filter((row) => row.averageOverLimitKph !== null).length > 0
      ? rows.reduce((sum, row) => sum + (row.averageOverLimitKph ?? 0), 0) /
        rows.filter((row) => row.averageOverLimitKph !== null).length
      : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drivers Speeding"
        description="Speeding event frequency and severity grouped by driver."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Drivers flagged</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{rows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Speeding events</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalEvents}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg over speed limit</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatKph(avgOverLimit)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Driver Speeding Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={tableRows}
            emptyMessage="No speeding data found."
            enableSorting
            sortableColumns={[
              "driverName",
              "speedingEvents",
              "highestSpeedDisplay",
              "averageOverLimitDisplay",
              "uniqueVehicleCount",
              "latestEventDisplay",
            ]}
            sortKeyMap={{
              driverName: "driver",
              speedingEvents: "events",
              highestSpeedDisplay: "highest_speed",
              averageOverLimitDisplay: "avg_over_limit",
              uniqueVehicleCount: "vehicles",
              latestEventDisplay: "latest_event",
            }}
            columns={[
              { key: "driverName", label: "Driver", link: "driverHref" },
              { key: "speedingEvents", label: "Events" },
              { key: "highestSpeedDisplay", label: "Highest speed" },
              { key: "averageOverLimitDisplay", label: "Avg over limit" },
              { key: "uniqueVehicleCount", label: "Vehicles" },
              { key: "latestEventDisplay", label: "Latest event" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
