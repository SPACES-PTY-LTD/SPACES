"use client"

import * as React from "react"
import Link from "next/link"
import moment from "moment"
import { AdminRoute } from "@/lib/routes/admin"
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
import type { Driver } from "@/lib/types"

export function DriverDialogContent({
  driverId,
  accessToken,
  merchantId,
}: {
  driverId: string
  accessToken: string
  merchantId?: string | null
}) {
  const [driver, setDriver] = React.useState<Driver | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadDriver = React.useCallback(async () => {
    setLoading(true)
    setError(null)

    const response = await getDriver(driverId, accessToken, {
      merchant_id: merchantId ?? undefined,
    })

    if (isApiErrorResponse(response)) {
      setDriver(null)
      setError(response.message)
      setLoading(false)
      return
    }

    setDriver(response)
    setLoading(false)
  }, [accessToken, driverId, merchantId])

  React.useEffect(() => {
    void loadDriver()
  }, [loadDriver])

  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center text-sm text-muted-foreground">
        Loading driver...
      </div>
    )
  }

  if (error || !driver) {
    return (
      <ErrorMessage
        title="Driver"
        description="Driver profile and vehicle assignments."
        message={error ?? "Failed to load driver."}
      />
    )
  }

  const statusLabel = driver.status ?? (driver.is_active ? "active" : "inactive")

  return (
    <div className="space-y-6">
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
