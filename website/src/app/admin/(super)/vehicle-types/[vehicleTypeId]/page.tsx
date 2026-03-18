import { AdminLinks } from "@/lib/routes/admin"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ErrorMessage } from "@/components/common/error-message"
import { isApiErrorResponse } from "@/lib/api/client"
import { getVehicleType } from "@/lib/api/vehicle-types"
import { requireAuth } from "@/lib/auth"

export default async function VehicleTypeDetailPage({
  params,
}: {
  params: Promise<{ vehicleTypeId: string }>
}) {
  const { vehicleTypeId } = await params
  const session = await requireAuth()
  const vehicleType = await getVehicleType(
    vehicleTypeId,
    session.accessToken
  )
  if (isApiErrorResponse(vehicleType)) {
    return (
      <ErrorMessage
        title="Vehicle type"
        description="Vehicle type attributes and availability."
        message={vehicleType.message}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Vehicle Types", href: AdminLinks.vehicleTypes },
          { label: vehicleType.name },
        ]}
      />
      <PageHeader
        title={vehicleType.name}
        description="Vehicle type attributes and availability."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline">Edit</Button>
            <Button variant="destructive">Delete</Button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 text-sm">
            <div className="text-xs text-muted-foreground">Payload</div>
            <div className="font-medium">{vehicleType.payloadKg} kg</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 text-sm">
            <div className="text-xs text-muted-foreground">Status</div>
            <StatusBadge status={vehicleType.status} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
