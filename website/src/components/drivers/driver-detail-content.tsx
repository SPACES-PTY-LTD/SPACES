import Link from "next/link"
import moment from "moment"
import { AdminLinks, AdminRoute } from "@/lib/routes/admin"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorMessage } from "@/components/common/error-message"
import { Card, CardContent } from "@/components/ui/card"
import { DriverDetailActions } from "@/components/drivers/driver-detail-actions"
import { VehicleDialog } from "@/components/drivers/vehicle-dialog"
import { DriverVehiclesTable } from "@/components/drivers/driver-vehicles-table"
import { EntityFilesSection } from "@/components/files/entity-files-section"
import { isApiErrorResponse } from "@/lib/api/client"
import { getDriver } from "@/lib/api/drivers"

export async function DriverDetailContent({
  driverId,
  accessToken,
  merchantId,
  embedded = false,
}: {
  driverId: string
  accessToken: string
  merchantId?: string | null
  embedded?: boolean
}) {
  const driver = await getDriver(driverId, accessToken, {
    merchant_id: merchantId ?? undefined,
  })

  if (isApiErrorResponse(driver)) {
    return (
      <ErrorMessage
        title="Driver"
        description="Driver profile and vehicle assignments."
        message={driver.message}
      />
    )
  }

  const statusLabel = driver.status ?? (driver.is_active ? "active" : "inactive")

  return (
    <div className={embedded ? undefined : "space-y-6"}>
      {!embedded ? (
        <Breadcrumbs
          items={[
            { label: "Drivers", href: AdminLinks.drivers },
            { label: driver.name },
          ]}
        />
      ) : null}
      <PageHeader
        title={driver.name}
        description="Driver profile and vehicle assignments."
        actions={<DriverDetailActions driver={driver} accessToken={accessToken} />}
      />

      <Card>
        <CardContent className="space-y-4 ">
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="font-medium">
                <StatusBadge status={statusLabel} />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="font-medium">{driver.email ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Telephone</div>
              <div className="font-medium">{driver.telephone ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Carrier</div>
              <div className="font-medium">
                {driver.carrier?.name && driver.carrier?.carrier_id ? (
                  <Link
                    className="text-primary underline-offset-4 hover:underline"
                    href={AdminRoute.carrierDetails(driver.carrier.carrier_id)}
                  >
                    {driver.carrier.name}
                  </Link>
                ) : (
                  "-"
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Notes</div>
              <div className="font-medium">{driver.notes ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Created</div>
              <div className="font-medium">
                {driver.created_at
                  ? moment(driver.created_at).format("YYYY-MM-DD HH:mm")
                  : "-"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EntityFilesSection
        entityType="driver"
        entityId={driver.driver_id}
        accessToken={accessToken}
        merchantId={merchantId ?? undefined}
        title="Files"
        sectionId="files"
      />

      <Card>
        <CardContent className="space-y-4 ">
          <div className="flex items-start justify-between">
            <div className="text-sm font-bold">Assigned vehicles</div>
            <VehicleDialog
              driverId={driver.driver_id}
              accessToken={accessToken}
              merchantId={merchantId ?? undefined}
              assignedVehicleIds={driver.vehicles.flatMap((vehicle) => {
                const id =
                  vehicle.vehicle_id ?? vehicle.vehicle_uuid ?? vehicle.driver_vehicle_id
                return id ? [id] : []
              })}
            />
          </div>
          <DriverVehiclesTable
            driverId={driver.driver_id}
            vehicles={driver.vehicles}
            accessToken={accessToken}
          />
        </CardContent>
      </Card>
    </div>
  )
}
