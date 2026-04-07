import Link from "next/link"
import moment from "moment"
import { AdminLinks, withAdminQuery } from "@/lib/routes/admin"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { ErrorMessage } from "@/components/common/error-message"
import { Card, CardContent } from "@/components/ui/card"
import { LocationDetailActions } from "@/components/locations/location-detail-actions"
import { LocationGeofence } from "@/components/locations/location-geofence"
import { LocationTruckActivityTimelineCard } from "@/components/locations/location-truck-activity-timeline-card"
import { EntryTagsManager } from "@/components/common/entry-tags-manager"
import { isApiErrorResponse } from "@/lib/api/client"
import { getLocation } from "@/lib/api/locations"
import { getShipmentsFullReport } from "@/lib/api/reports"
import { listVehicleActivities } from "@/lib/api/vehicle-activities"
import type { Location } from "@/lib/types"

function getLocationTitle(location: Location) {
  if (location.name) return location.name
  if (location.company) return location.company
  return "Location"
}

export async function LocationDetailContent({
  locationId,
  accessToken,
  merchantId,
  embedded = false,
}: {
  locationId: string
  accessToken: string
  merchantId?: string | null
  embedded?: boolean
}) {
  const [location, activitiesResponse, shipmentsFromResponse, shipmentsToResponse] =
    await Promise.all([
      getLocation(locationId, accessToken, {
        merchant_id: merchantId ?? undefined,
      }),
      listVehicleActivities(accessToken, {
        merchant_id: merchantId ?? undefined,
        location_id: locationId,
        page: 1,
        per_page: 50,
      }),
      getShipmentsFullReport(
        {
          merchant_id: merchantId ?? undefined,
          from_location_id: locationId,
          page: 1,
          per_page: 1,
        },
        accessToken
      ),
      getShipmentsFullReport(
        {
          merchant_id: merchantId ?? undefined,
          to_location_id: locationId,
          page: 1,
          per_page: 1,
        },
        accessToken
      ),
    ])

  if (isApiErrorResponse(location)) {
    return (
      <ErrorMessage
        title="Location"
        description="Location details and coordinates."
        message={location.message}
      />
    )
  }

  const activities = !isApiErrorResponse(activitiesResponse) ? activitiesResponse.data ?? [] : []
  const locationActivityCount = !isApiErrorResponse(activitiesResponse)
    ? Number(activitiesResponse.meta?.total ?? activities.length)
    : 0
  const vehiclesAtLocation = new Set(
    activities
      .map((activity) => activity.vehicle?.vehicle_id ?? activity.vehicle_id)
      .filter((value): value is string => Boolean(value))
  ).size
  const speedingEvents = activities.filter((activity) => {
    if (activity.event_type === "speeding") return true
    return (
      typeof activity.speed_kph === "number" &&
      typeof activity.speed_limit_kph === "number" &&
      activity.speed_kph > activity.speed_limit_kph
    )
  }).length
  const outboundShipmentCount = !isApiErrorResponse(shipmentsFromResponse)
    ? Number(shipmentsFromResponse.meta?.total ?? shipmentsFromResponse.data?.length ?? 0)
    : 0
  const inboundShipmentCount = !isApiErrorResponse(shipmentsToResponse)
    ? Number(shipmentsToResponse.meta?.total ?? shipmentsToResponse.data?.length ?? 0)
    : 0
  const statLinks = [
    {
      label: "Recent vehicle events",
      value: String(locationActivityCount),
      href: withAdminQuery(AdminLinks.vehicleActivities, { location_id: locationId }),
    },
    {
      label: "Vehicles seen here",
      value: String(vehiclesAtLocation),
      href: withAdminQuery(AdminLinks.vehicleActivities, { location_id: locationId }),
    },
    {
      label: "Speeding events",
      value: String(speedingEvents),
      href: withAdminQuery(AdminLinks.vehicleActivities, {
        location_id: locationId,
        event_type: "speeding",
      }),
    },
    {
      label: "Outbound shipments",
      value: String(outboundShipmentCount),
      href: withAdminQuery(AdminLinks.reportsShipments, { from_location_id: locationId }),
    },
    {
      label: "Inbound shipments",
      value: String(inboundShipmentCount),
      href: withAdminQuery(AdminLinks.reportsShipments, { to_location_id: locationId }),
    },
  ]

  const title = getLocationTitle(location)
  const detailItems = [
    { label: "Type", value: location.type?.title },
    { label: "Company", value: location.company },
    { label: "Code", value: location.code },
    { label: "Address line 1", value: location.address_line_1 },
    { label: "Address line 2", value: location.address_line_2 },
    { label: "Town", value: location.town },
    { label: "City", value: location.city },
    { label: "Province", value: location.province },
    { label: "Postal code", value: location.post_code },
    { label: "Country", value: location.country },
    { label: "Phone", value: location.phone },
    { label: "First name", value: location.first_name },
    { label: "Last name", value: location.last_name },
    { label: "Latitude", value: location.latitude },
    { label: "Longitude", value: location.longitude },
    {
      label: "Created",
      value: location.created_at ? moment(location.created_at).format("YYYY-MM-DD HH:mm") : null,
    },
  ].filter((item) => item.value !== null && item.value !== undefined && item.value !== "")

  return (
    <div className={embedded ? undefined : "space-y-6"}>
      {!embedded ? (
        <Breadcrumbs
          items={[
            { label: "Locations", href: AdminLinks.locations },
            { label: title },
          ]}
        />
      ) : null}
      <PageHeader
        title={title}
        description="Location details and coordinates."
        actions={<LocationDetailActions location={location} accessToken={accessToken} />}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <LocationGeofence location={location} accessToken={accessToken} />

        <Card>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 text-sm">
              {detailItems.map((item) => (
                <div key={item.label}>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="font-medium">{String(item.value)}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 border-t border-border py-3 md:grid-cols-2">
              {statLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-md border border-border/60 p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="font-medium">{item.value}</div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <EntryTagsManager
        entityType="location"
        entityId={locationId}
        merchantId={merchantId ?? location.merchant_id ?? null}
        accessToken={accessToken}
        initialTags={location.tags ?? []}
      />

      <LocationTruckActivityTimelineCard
        locationId={locationId}
        merchantId={merchantId ?? undefined}
        accessToken={accessToken}
      />
    </div>
  )
}
