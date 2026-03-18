import { AdminLinks } from "@/lib/routes/admin"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorMessage } from "@/components/common/error-message"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { isApiErrorResponse } from "@/lib/api/client"
import { getCarrier } from "@/lib/api/carriers"
import { requireAuth } from "@/lib/auth"

export default async function CarrierDetailPage({
  params,
}: {
  params: Promise<{ carrierId: string }>
}) {
  const { carrierId } = await params
  const session = await requireAuth()
  const carrier = await getCarrier(carrierId, session.accessToken)
  if (isApiErrorResponse(carrier)) {
    return (
      <ErrorMessage
        title="Carrier"
        description="Carrier configuration and performance notes."
        message={carrier.message}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Carriers", href: AdminLinks.carriers },
          { label: carrier.name },
        ]}
      />
      <PageHeader
        title={carrier.name}
        description="Carrier configuration and performance notes."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline">Edit carrier</Button>
            <Button variant="destructive">Delete</Button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 text-sm">
            <div className="text-xs text-muted-foreground">Status</div>
            <StatusBadge status={carrier.status} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
