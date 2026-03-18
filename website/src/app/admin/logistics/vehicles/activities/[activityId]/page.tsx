import Link from "next/link"
import moment from "moment"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { ErrorMessage } from "@/components/common/error-message"
import { StatusBadge } from "@/components/common/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getVehicleActivity } from "@/lib/api/vehicle-activities"
import { isApiErrorResponse } from "@/lib/api/client"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { AdminLinks, AdminRoute } from "@/lib/routes/admin"
import type { VehicleActivity } from "@/lib/types"

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  return moment(value).format("YYYY-MM-DD HH:mm:ss")
}

function formatEventType(value?: string | null) {
  if (!value) return "-"
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

function formatCoordinates(latitude?: number | null, longitude?: number | null) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return "-"
  }

  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

function formatSpeed(speed?: number | null, limit?: number | null) {
  if (typeof speed !== "number" && typeof limit !== "number") {
    return "-"
  }

  const speedLabel = typeof speed === "number" ? `${speed} kph` : "-"
  const limitLabel = typeof limit === "number" ? `${limit} kph` : "-"

  return `${speedLabel} / ${limitLabel}`
}

function formatJson(value: unknown) {
  if (!value || (typeof value === "object" && Object.keys(value).length === 0)) {
    return "-"
  }

  return JSON.stringify(value, null, 2)
}

function buildMapHref(activity: VehicleActivity) {
  if (typeof activity.latitude !== "number" || typeof activity.longitude !== "number") {
    return null
  }

  return `https://www.google.com/maps?q=${activity.latitude},${activity.longitude}`
}

function DetailRow({
  label,
  value,
  href,
}: {
  label: string
  value?: string | null
  href?: string | null
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:gap-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium break-all">
        {value ? (
          href ? (
            <Link className="text-primary underline-offset-4 hover:underline" href={href}>
              {value}
            </Link>
          ) : (
            value
          )
        ) : (
          "-"
        )}
      </div>
    </div>
  )
}

function EventSummaryCard({ activity }: { activity: VehicleActivity }) {
  const coordinates = formatCoordinates(activity.latitude, activity.longitude)
  const speed = formatSpeed(activity.speed_kph, activity.speed_limit_kph)
  const mapHref = buildMapHref(activity)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-2">
          <CardTitle>{formatEventType(activity.event_type)}</CardTitle>
          <div className="text-sm text-muted-foreground">
            Recorded {formatDateTime(activity.occurred_at)}
          </div>
        </div>
        <StatusBadge status={activity.event_type ?? "unknown"} />
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Coordinates</div>
          <div className="mt-2 text-sm font-medium">{coordinates}</div>
          {mapHref ? (
            <Button asChild variant="link" className="mt-2 h-auto p-0">
              <Link href={mapHref} target="_blank" rel="noreferrer">
                Open on map
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Speed / Limit</div>
          <div className="mt-2 text-sm font-medium">{speed}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Location Visit</div>
          <div className="mt-2 text-sm font-medium">
            {activity.entered_at || activity.exited_at
              ? `${formatDateTime(activity.entered_at)} -> ${formatDateTime(activity.exited_at)}`
              : "-"}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function VehicleActivityDetailPage({
  params,
}: {
  params: Promise<{ activityId: string }>
}) {
  const { activityId } = await params
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)
  const activity = await getVehicleActivity(activityId, session.accessToken)

  if (isApiErrorResponse(activity)) {
    return (
      <ErrorMessage
        title="Vehicle activity"
        description="Inspect one recorded vehicle event in full detail."
        message={activity.message}
      />
    )
  }

  const merchantHref =
    session.user.role === "super_admin" && activity.merchant?.merchant_id
      ? AdminRoute.merchantDetails(activity.merchant.merchant_id)
      : null
  const vehicleHref = activity.vehicle?.vehicle_id
    ? AdminRoute.vehicleDetails(activity.vehicle.vehicle_id)
    : null
  const driverHref = activity.driver?.driver_id
    ? AdminRoute.driverDetails(activity.driver.driver_id)
    : null
  const locationHref = activity.location?.location_id
    ? AdminRoute.locationDetails(activity.location.location_id)
    : null
  const shipmentHref = activity.shipment?.shipment_id
    ? AdminRoute.shipmentDetails(activity.shipment.shipment_id)
    : null
  const filteredListHref = activity.vehicle?.vehicle_id
    ? `${AdminLinks.vehicleActivities}?vehicle_id=${activity.vehicle.vehicle_id}`
    : AdminLinks.vehicleActivities

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Vehicle activities", href: filteredListHref },
          { label: activity.activity_id ?? activityId },
        ]}
      />

      <PageHeader
        title={formatEventType(activity.event_type)}
        description="Inspect one recorded vehicle event in full detail."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={filteredListHref}>Back to activities</Link>
            </Button>
            {vehicleHref ? (
              <Button asChild>
                <Link href={vehicleHref}>Open vehicle</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <EventSummaryCard activity={activity} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Activity details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailRow label="Activity ID" value={activity.activity_id} />
            <DetailRow label="Occurred At" value={formatDateTime(activity.occurred_at)} />
            <DetailRow label="Created At" value={formatDateTime(activity.created_at)} />
            <DetailRow label="Entered At" value={formatDateTime(activity.entered_at)} />
            <DetailRow label="Exited At" value={formatDateTime(activity.exited_at)} />
            <DetailRow label="Exit Reason" value={activity.exit_reason} />
            <DetailRow label="Run ID" value={activity.run_id} />
            <DetailRow label="Merchant" value={activity.merchant?.name ?? activity.merchant?.merchant_id} href={merchantHref} />
            <DetailRow
              label="Vehicle"
              value={activity.vehicle?.plate_number ?? activity.vehicle?.ref_code ?? activity.vehicle?.vehicle_id}
              href={vehicleHref}
            />
            <DetailRow
              label="Vehicle Make / Model"
              value={[activity.vehicle?.make, activity.vehicle?.model].filter(Boolean).join(" ") || null}
            />
            <DetailRow
              label="Driver"
              value={activity.driver?.name ?? activity.driver?.email ?? activity.driver?.driver_id}
              href={driverHref}
            />
            <DetailRow
              label="Location"
              value={activity.location?.name ?? activity.location?.code ?? activity.location?.location_id}
              href={locationHref}
            />
            <DetailRow
              label="Address"
              value={
                activity.location
                  ? [
                      activity.location.full_address,
                      activity.location.city,
                      activity.location.province,
                      activity.location.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || null
                  : null
              }
            />
            <DetailRow
              label="Shipment"
              value={activity.shipment?.merchant_order_ref ?? activity.shipment?.shipment_id}
              href={shipmentHref}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Driver snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow
                label="Assigned Driver"
                value={activity.driver?.name ?? activity.driver?.email ?? activity.driver?.driver_id}
                href={driverHref}
              />
              <DetailRow
                label="Last Vehicle Driver"
                value={
                  activity.vehicle?.last_driver?.name ??
                  activity.vehicle?.last_driver?.email ??
                  activity.vehicle?.last_driver?.driver_id
                }
              />
              <DetailRow
                label="Driver Logged At"
                value={formatDateTime(activity.vehicle?.driver_logged_at)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Raw metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-4 text-xs">
                {formatJson(activity.metadata)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>

      {merchantId ? (
        <div className="text-xs text-muted-foreground">
          Merchant scope: {merchantId}
        </div>
      ) : null}
    </div>
  )
}
