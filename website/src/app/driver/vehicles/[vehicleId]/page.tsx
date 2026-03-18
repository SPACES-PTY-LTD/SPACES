import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ErrorMessage } from "@/components/common/error-message"
import { isApiErrorResponse } from "@/lib/api/client"
import { getDriverVehicle } from "@/lib/api/driver"
import { requireAuth } from "@/lib/auth"

export default async function DriverVehicleDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>
}) {
  const { vehicleId } = await params
  const session = await requireAuth()
  const vehicle = await getDriverVehicle(vehicleId, session.accessToken)
  if (isApiErrorResponse(vehicle)) {
    return (
      <ErrorMessage
        title="Vehicle"
        description="Vehicle information and status."
        message={vehicle.message}
      />
    )
  }
  const plateNumberLabel = vehicle.plate_number ?? ""

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Driver", href: "/driver/vehicles" },
          { label: plateNumberLabel },
        ]}
      />
      <PageHeader
        title={plateNumberLabel}
        description="Vehicle information and status."
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
            <div className="text-xs text-muted-foreground">Type</div>
            <div className="font-medium">{vehicle.type?.name}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
