import { AdminLinks } from "@/lib/routes/admin"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { ErrorMessage } from "@/components/common/error-message"
import { Card, CardContent } from "@/components/ui/card"
import { VehicleDetailActions } from "@/components/vehicles/vehicle-detail-actions"
import { VehicleLocationMap } from "@/components/vehicles/vehicle-location-map"
import { VehicleActivityTimelineCard } from "@/components/vehicles/vehicle-activity-timeline-card"
import { EntityFilesSection } from "@/components/files/entity-files-section"
import { isApiErrorResponse } from "@/lib/api/client"
import { getVehicle } from "@/lib/api/vehicles"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import moment from "moment"

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>
}) {
  const { vehicleId } = await params
  const session = await requireAuth()
  const scopedMerchantId = getScopedMerchantId(session)
  const vehicle = await getVehicle(vehicleId, session.accessToken, {
    merchant_id: scopedMerchantId,
  })
  if (isApiErrorResponse(vehicle)) {
    return (
      <ErrorMessage
        title="Vehicle"
        description="Vehicle information and availability."
        message={vehicle.message}
      />
    )
  }
  const plateNumberLabel = vehicle.plate_number ?? ""
  const statusLabel =
    vehicle.maintenance_mode_at
      ? "maintenance"
      : vehicle.status ??
    (vehicle.is_active === false
      ? "inactive"
      : vehicle.is_active === true
        ? "active"
        : "unknown")
  const lastLocationLabel = vehicle.last_location_address
    ? [
        vehicle.last_location_address.address_line_1,
        vehicle.last_location_address.address_line_2,
        vehicle.last_location_address.city,
        vehicle.last_location_address.province,
        vehicle.last_location_address.post_code,
      ]
        .filter(Boolean)
        .join(", ")
    : "-"
  const latitude = Number(vehicle.last_location_address?.latitude)
  const longitude = Number(vehicle.last_location_address?.longitude)
  const hasLastKnownCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
  const detailItems = [
    { label: "Type", value: vehicle.type?.name },
    { label: "Status", value: statusLabel },
    { label: "Make", value: vehicle.make },
    { label: "Model", value: vehicle.model },
    { label: "Color", value: vehicle.color },
    { label: "Plate number", value: vehicle.plate_number },
    { label: "Photo key", value: vehicle.photo_key },
    { label: "VIN number", value: vehicle.vin_number },
    { label: "Odometer", value: vehicle.odometer },
    { label: "Engine number", value: vehicle.engine_number },
    { label: "Reference code", value: vehicle.ref_code },
    {
      label: "Maintenance mode at",
      value: vehicle.maintenance_mode_at
        ? moment(vehicle.maintenance_mode_at).format("YYYY-MM-DD HH:mm")
        : null,
    },
    {
      label: "Expected maintenance resolve",
      value: vehicle.maintenance_expected_resolved_at
        ? moment(vehicle.maintenance_expected_resolved_at).format("YYYY-MM-DD")
        : null,
    },
    {
      label: "Maintenance description",
      value: vehicle.maintenance_description,
    },
    { label: "Last location address", value: lastLocationLabel !== "-" ? lastLocationLabel : null },
    { label: "Latitude", value: hasLastKnownCoordinates ? latitude : null },
    { label: "Longitude", value: hasLastKnownCoordinates ? longitude : null },
    {
      label: "Location updated at",
      value: vehicle.location_updated_at
        ? moment(vehicle.location_updated_at).format("YYYY-MM-DD HH:mm")
        : null,
    },
    // { label: "Intergration ID", value: vehicle.intergration_id },
    {
      label: "Created",
      value: vehicle.created_at
        ? moment(vehicle.created_at).format("YYYY-MM-DD HH:mm")
        : null,
    },
    // {
    //   label: "Updated",
    //   value: vehicle.updated_at
    //     ? moment(vehicle.updated_at).format("YYYY-MM-DD HH:mm")
    //     : null,
    // },
  ].filter((item) => item.value !== null && item.value !== undefined && item.value !== "")

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Vehicles", href: AdminLinks.vehicles },
          { label: plateNumberLabel || "Vehicle" },
        ]}
      />
      <PageHeader
        title={plateNumberLabel || "Vehicle"}
        description="Vehicle information and availability."
        actions={
          <VehicleDetailActions
            vehicle={vehicle}
            merchantId={scopedMerchantId ?? vehicle.merchant_id ?? null}
            accessToken={session.accessToken}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {hasLastKnownCoordinates ? (
          <VehicleLocationMap
            latitude={latitude}
            longitude={longitude}
            label={lastLocationLabel || vehicle.plate_number || vehicle.ref_code || "Vehicle location"}
          />
        ) : (
          <Card>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">Last known location</div>
                <div className="font-medium">{lastLocationLabel || "Unknown"}</div>
              </div>
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                We can only show the map if the vehicle&apos;s last location is known.
              </div>
            </CardContent>
          </Card>
        )}

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
          </CardContent>
        </Card>
      </div>

      <EntityFilesSection
        entityType="vehicle"
        entityId={vehicleId}
        accessToken={session.accessToken}
        merchantId={scopedMerchantId}
        title="Files"
        sectionId="files"
      />

      <VehicleActivityTimelineCard
        accessToken={session.accessToken}
        vehicleId={vehicleId}
        merchantId={scopedMerchantId}
      />
    </div>
  )
}
