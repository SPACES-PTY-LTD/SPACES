import { AdminLinks, AdminRoute } from "@/lib/routes/admin"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { isApiErrorResponse } from "@/lib/api/client"
import { listVehicleActivities } from "@/lib/api/vehicle-activities"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"
import type { VehicleActivity } from "@/lib/types"

type VehicleActivitiesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : (value ?? "")
}

function normalizeText(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function toPositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 1) return fallback
  return parsed
}

function formatEventType(value: string) {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

function formatCoordinates(latitude?: number | null, longitude?: number | null) {
  if (typeof latitude !== "number" || typeof longitude !== "number") return "-"
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}

function formatSpeed(speed?: number | null, limit?: number | null) {
  if (typeof speed !== "number" && typeof limit !== "number") return "-"
  const speedLabel = typeof speed === "number" ? `${speed} kph` : "-"
  const limitLabel = typeof limit === "number" ? `${limit} kph` : "-"
  return `${speedLabel} / ${limitLabel}`
}

export default async function VehicleActivitiesPage({ searchParams }: VehicleActivitiesPageProps) {
  const params = (await searchParams) ?? {}
  const merchantIdParam = getSingleValue(params.merchant_id)
  const vehicleId = getSingleValue(params.vehicle_id)
  const locationId = getSingleValue(params.location_id)
  const plateNumber = getSingleValue(params.plate_number)
  const eventType = getSingleValue(params.event_type)
  const from = getSingleValue(params.from)
  const to = getSingleValue(params.to)
  const page = toPositiveInt(getSingleValue(params.page), 1)
  const perPage = Math.min(100, toPositiveInt(getSingleValue(params.per_page), 20))

  const session = await requireAuth()
  const scopedMerchantId = getScopedMerchantId(session)
  const canLoad = session.user.role === "super_admin" || Boolean(scopedMerchantId)
  const merchantId =
    session.user.role === "super_admin"
      ? normalizeText(merchantIdParam)
      : scopedMerchantId

  const response = canLoad
    ? await listVehicleActivities(session.accessToken, {
        page,
        per_page: perPage,
        merchant_id: merchantId,
        vehicle_id: normalizeText(vehicleId),
        location_id: normalizeText(locationId),
        plate_number: normalizeText(plateNumber),
        event_type: normalizeText(eventType),
        from: normalizeText(from),
        to: normalizeText(to),
      })
    : null

  const isError = response ? isApiErrorResponse(response) : false
  const loadingError = canLoad
    ? isError
      ? (response && isApiErrorResponse(response)
          ? response.message
          : "Failed to load vehicle activities.")
      : null
    : "Select a merchant to view vehicle activities."

  const activities: VehicleActivity[] =
    response && !isApiErrorResponse(response) ? response.data ?? [] : []

  const rows = activities.map((item) => ({
    ...item,
    activity_href: item.activity_id ? AdminRoute.vehicleActivityDetails(item.activity_id) : "",
    event_type_display: item.event_type ? formatEventType(item.event_type) : "-",
    merchant_name_display: item.merchant?.name ?? item.merchant_id ?? "-",
    vehicle_display: item.vehicle?.plate_number ?? item.vehicle?.ref_code ?? item.vehicle_id ?? "-",
    driver_display: item.driver?.name ?? item.driver?.email ?? item.driver?.driver_id ?? "-",
    location_display: item.location?.name ?? item.location?.code ?? item.location_id ?? "-",
    shipment_display:
      item.shipment?.merchant_order_ref ?? item.shipment?.shipment_id ?? "-",
    coordinates_display: formatCoordinates(item.latitude, item.longitude),
    speed_display: formatSpeed(item.speed_kph, item.speed_limit_kph),
    merchant_href: item.merchant_id ? AdminRoute.merchantDetails(item.merchant_id) : "",
    vehicle_href: item.vehicle?.vehicle_id ? AdminRoute.vehicleDetails(item.vehicle.vehicle_id) : "",
    driver_href: item.driver?.driver_id ? AdminRoute.driverDetails(item.driver.driver_id) : "",
    location_href: item.location_id ? AdminRoute.locationDetails(item.location_id) : "",
    shipment_href: item.shipment?.shipment_id
      ? AdminRoute.shipmentDetails(item.shipment.shipment_id)
      : "",
  }))

  const tableMeta =
    response && !isApiErrorResponse(response)
      ? normalizeTableMeta(response.meta)
      : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle activities"
        description="Monitor vehicle events like movement, speeding, and geofence entries."
      />

      <DataTable
        views={[
          {
            label: "All",
            href: AdminLinks.vehicleActivities,
          },
        ]}
        data={rows}
        meta={tableMeta}
        loading_error={loadingError}
        searchKeys={[
          "activity_id",
          "event_type_display",
          "merchant_name_display",
          "vehicle_display",
          "location_display",
          "run_id",
        ]}
        filters={[
          ...(session.user.role === "super_admin"
            ? [
                {
                  key: "merchant_id",
                  label: "Merchant ID",
                  type: "text" as const,
                  value: merchantIdParam,
                  url_param_name: "merchant_id",
                  placeholder: "Merchant ID",
                },
              ]
            : []),
          {
            key: "vehicle_id",
            label: "Vehicle ID",
            type: "text",
            value: vehicleId,
            url_param_name: "vehicle_id",
            placeholder: "Vehicle ID",
          },
          {
            key: "location_id",
            label: "Location ID",
            type: "text",
            value: locationId,
            url_param_name: "location_id",
            placeholder: "Location ID",
          },
          {
            key: "plate_number",
            label: "Plate number",
            type: "text",
            value: plateNumber,
            url_param_name: "plate_number",
            placeholder: "Plate number",
          },
          {
            key: "event_type",
            label: "Event type",
            value: eventType,
            url_param_name: "event_type",
            options: [
              { label: "Speeding", value: "speeding" },
              { label: "Stopped", value: "stopped" },
              { label: "Moving", value: "moving" },
              { label: "Entered location", value: "entered_location" },
              { label: "Exited location", value: "exited_location" },
            ],
          },
          {
            key: "from",
            label: "From",
            type: "date",
            value: from,
            url_param_name: "from",
            placeholder: "From date",
          },
          {
            key: "to",
            label: "To",
            type: "date",
            value: to,
            url_param_name: "to",
            placeholder: "To date",
          },
          {
            key: "per_page",
            label: "Per page",
            value: String(perPage),
            url_param_name: "per_page",
            options: [
              { label: "20", value: "20" },
              { label: "50", value: "50" },
              { label: "100", value: "100" },
            ],
          },
        ]}
        columns={[
          { key: "activity_id", label: "Activity ID", link: "activity_href" },
          { key: "occurred_at", label: "Occurred", type: "date_time", format: "YYYY-MM-DD HH:mm", link: "activity_href" },
          { key: "event_type_display", label: "Event", link: "activity_href" },
          { key: "merchant_name_display", label: "Merchant", link: "merchant_href" },
          { key: "vehicle_display", label: "Vehicle", link: "vehicle_href" },
          { key: "driver_display", label: "Driver", link: "driver_href" },
          { key: "location_display", label: "Location", link: "location_href" },
          { key: "shipment_display", label: "Shipment", link: "shipment_href" },
          { key: "coordinates_display", label: "Coordinates", link: "activity_href" },
          { key: "speed_display", label: "Speed / Limit", link: "activity_href" },
          { key: "run_id", label: "Run ID", link: "activity_href" } 
        ]}
      />
    </div>
  )
}
