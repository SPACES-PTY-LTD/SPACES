import Link from "next/link"
import { CreatedOverTimeChart } from "@/components/reports/created-over-time-chart"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { isApiErrorResponse } from "@/lib/api/client"
import { listLocations } from "@/lib/api/locations"
import { getDashboardStats, getShipmentsFullReport } from "@/lib/api/reports"
import { listVehicleActivities } from "@/lib/api/vehicle-activities"
import { requireAuth } from "@/lib/auth"
import { AdminLinks, AdminRoute, withAdminQuery } from "@/lib/routes/admin"

type SummaryItem = {
  label: string
  href: string
  count: number
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function getLocationLabel(location?: {
  location_id?: string
  name?: string | null
  code?: string | null
  company?: string | null
} | null) {
  return (
    location?.name ??
    location?.company ??
    location?.code ??
    location?.location_id ??
    "Unknown location"
  )
}

function getVehicleLabel(activity: {
  vehicle_id?: string | null
  vehicle?: {
    plate_number?: string | null
    ref_code?: string | null
    vehicle_id?: string
  } | null
}) {
  return (
    activity.vehicle?.plate_number ??
    activity.vehicle?.ref_code ??
    activity.vehicle?.vehicle_id ??
    activity.vehicle_id ??
    "Unknown vehicle"
  )
}

function getRouteKey(row: {
  from_location?: { location_id?: string; name?: string | null; code?: string | null } | null
  to_location?: { location_id?: string; name?: string | null; code?: string | null } | null
}) {
  return [
    row.from_location?.location_id ?? row.from_location?.name ?? "unknown-from",
    row.to_location?.location_id ?? row.to_location?.name ?? "unknown-to",
  ].join("::")
}

function getRouteLabel(row: {
  from_location?: { name?: string | null; code?: string | null } | null
  to_location?: { name?: string | null; code?: string | null } | null
}) {
  return `${getLocationLabel(row.from_location)} -> ${getLocationLabel(row.to_location)}`
}

function countByStatus(rows: Array<{ shipment_status?: string }>) {
  const counts = new Map<string, number>()

  for (const row of rows) {
    const key = row.shipment_status?.trim() || "unknown"
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([status, value]) => ({ status, value }))
    .sort((a, b) => b.value - a.value)
}

export default async function LogisticsAnalyticsPage() {
  const session = await requireAuth()
  const merchantId = session.selected_merchant?.merchant_id ?? undefined
  const canLoadMerchantScopedData = Boolean(merchantId)

  const [statsResponse, locationsResponse, activitiesResponse, shipmentReportResponse] =
    await Promise.all([
      canLoadMerchantScopedData
        ? getDashboardStats(session.accessToken, {
            merchant_id: merchantId,
          })
        : null,
      canLoadMerchantScopedData
        ? listLocations(session.accessToken, {
            merchant_id: merchantId,
            page: 1,
            per_page: 1,
          })
        : null,
      canLoadMerchantScopedData
        ? listVehicleActivities(session.accessToken, {
            merchant_id: merchantId,
            page: 1,
            per_page: 200,
          })
        : null,
      canLoadMerchantScopedData
        ? getShipmentsFullReport(
            {
              merchant_id: merchantId,
              page: 1,
              per_page: 200,
            },
            session.accessToken
          )
        : null,
    ])

  const stats = statsResponse && !isApiErrorResponse(statsResponse)
    ? (statsResponse.data ?? {
        total_shipments: 0,
        delivered_shipments: 0,
        in_transit_bookings: 0,
        pending_shipments: 0,
        active_merchants: 0,
        active_quotes: 0,
        total_members: 0,
      })
    : {
        total_shipments: 0,
        delivered_shipments: 0,
        in_transit_bookings: 0,
        pending_shipments: 0,
        active_merchants: 0,
        active_quotes: 0,
        total_members: 0,
      }

  const locationCount =
    locationsResponse && !isApiErrorResponse(locationsResponse)
      ? Number(locationsResponse.meta?.total ?? locationsResponse.data?.length ?? 0)
      : 0
  const activities =
    activitiesResponse && !isApiErrorResponse(activitiesResponse)
      ? activitiesResponse.data ?? []
      : []
  const activityCount =
    activitiesResponse && !isApiErrorResponse(activitiesResponse)
      ? Number(activitiesResponse.meta?.total ?? activities.length)
      : 0
  const shipmentRows =
    shipmentReportResponse && !isApiErrorResponse(shipmentReportResponse)
      ? shipmentReportResponse.data ?? []
      : []

  const kpis = [
    {
      label: "Total shipments",
      value: formatCount(stats.total_shipments),
      href: AdminLinks.shipments,
    },
    {
      label: "Delivered shipments",
      value: formatCount(stats.delivered_shipments),
      href: withAdminQuery(AdminLinks.reportsShipments, {
        shipment_status: "delivered",
      }),
    },
    {
      label: "In-transit bookings",
      value: formatCount(stats.in_transit_bookings),
      href: AdminLinks.bookings,
    },
    {
      label: "Pending shipments",
      value: formatCount(stats.pending_shipments),
      href: withAdminQuery(AdminLinks.reportsShipments, {
        shipment_status: "pending",
      }),
    },
    {
      label: "Tracked locations",
      value: formatCount(locationCount),
      href: AdminLinks.locations,
    },
    {
      label: "Vehicle activities",
      value: formatCount(activityCount),
      href: AdminLinks.vehicleActivities,
    },
    {
      label: "Active quotes",
      value: formatCount(stats.active_quotes),
      href: AdminLinks.quotes,
    },
  ]

  const mostActiveLocations = Array.from(
    activities.reduce<
      Map<
        string,
        {
          label: string
          href: string
          count: number
        }
      >
    >((acc, activity) => {
      const locationId = activity.location?.location_id ?? activity.location_id
      if (!locationId) return acc

      const key = String(locationId)
      const current = acc.get(key)
      acc.set(key, {
        label: getLocationLabel(activity.location),
        href: AdminRoute.locationDetails(locationId),
        count: (current?.count ?? 0) + 1,
      })
      return acc
    }, new Map())
  )
    .map(([, value]) => value)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const mostActiveRoutes = Array.from(
    shipmentRows.reduce<
      Map<
        string,
        {
          label: string
          href: string
          count: number
        }
      >
    >((acc, row) => {
      if (!row.from_location && !row.to_location) return acc

      const key = getRouteKey(row)
      const current = acc.get(key)
      acc.set(key, {
        label: getRouteLabel(row),
        href: withAdminQuery(AdminLinks.reportsShipments, {
          from_location_id: row.from_location?.location_id,
          to_location_id: row.to_location?.location_id,
        }),
        count: (current?.count ?? 0) + 1,
      })
      return acc
    }, new Map())
  )
    .map(([, value]) => value)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const speedingVehicles = Array.from(
    activities.reduce<
      Map<
        string,
        {
          label: string
          href: string
          count: number
        }
      >
    >((acc, activity) => {
      const isSpeeding =
        activity.event_type === "speeding" ||
        (typeof activity.speed_kph === "number" &&
          typeof activity.speed_limit_kph === "number" &&
          activity.speed_kph > activity.speed_limit_kph)
      const vehicleId = activity.vehicle?.vehicle_id ?? activity.vehicle_id
      if (!isSpeeding || !vehicleId) return acc

      const key = String(vehicleId)
      const current = acc.get(key)
      acc.set(key, {
        label: getVehicleLabel(activity),
        href: AdminRoute.vehicleDetails(vehicleId),
        count: (current?.count ?? 0) + 1,
      })
      return acc
    }, new Map())
  )
    .map(([, value]) => value)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const shipmentStatusData = countByStatus(shipmentRows)
  const shipmentStatusTotal = shipmentStatusData.reduce((sum, item) => sum + item.value, 0)
  const merchantScopedMessage = canLoadMerchantScopedData
    ? null
    : "Select a merchant to load location and vehicle activity analytics."

  const renderSummaryList = (items: SummaryItem[], emptyState: string) =>
    items.length > 0 ? (
      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={`${item.label}-${item.href}`}
            href={item.href}
            className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
          >
            <span className="truncate">{item.label}</span>
            <span className="font-medium">{formatCount(item.count)}</span>
          </Link>
        ))}
      </div>
    ) : (
      <div className="text-sm text-muted-foreground">{emptyState}</div>
    )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Live logistics activity linked back to the operational pages."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7">
        {kpis.map((kpi) => (
          <Link href={kpi.href} className="group" key={kpi.label}>
            <Card className="gap-0 py-3 transition-shadow group-hover:shadow-md">
              <CardHeader className="px-3 mb-0">
                <CardTitle className="text-sm text-muted-foreground mb-0 pb-0">
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 py-0 text-lg font-semibold">
                {kpi.value}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <CreatedOverTimeChart
          accessToken={session.accessToken}
          merchantId={merchantId}
        />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Shipments by status</CardTitle>
              <Link
                href={AdminLinks.reportsShipments}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                View report
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {shipmentStatusData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Percentage</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipmentStatusData.map((item) => (
                    <TableRow key={item.status}>
                      <TableCell>
                        <Link
                          href={withAdminQuery(AdminLinks.reportsShipments, {
                            shipment_status: item.status === "unknown" ? undefined : item.status,
                          })}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {item.status}
                        </Link>
                      </TableCell>
                      <TableCell>{formatCount(item.value)}</TableCell>
                      <TableCell>
                        {shipmentStatusTotal > 0
                          ? `${((item.value / shipmentStatusTotal) * 100).toFixed(1)}%`
                          : "0%"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground">
                No shipment report data available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {merchantScopedMessage ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            {merchantScopedMessage}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Most active locations</CardTitle>
              <Link
                href={AdminLinks.locations}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                View locations
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {renderSummaryList(
              mostActiveLocations,
              "No location activity found for the current scope."
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Most active routes</CardTitle>
              <Link
                href={AdminLinks.reportsShipments}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                View report
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {renderSummaryList(
              mostActiveRoutes,
              "No route activity found in the shipment report."
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Speeding vehicles</CardTitle>
              <Link
                href={withAdminQuery(AdminLinks.vehicleActivities, { event_type: "speeding" })}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                View activity
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {renderSummaryList(
              speedingVehicles,
              "No speeding activity found for the current scope."
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
