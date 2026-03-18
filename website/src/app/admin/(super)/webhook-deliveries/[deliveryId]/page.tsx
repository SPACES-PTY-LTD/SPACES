import { AdminLinks } from "@/lib/routes/admin"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ErrorMessage } from "@/components/common/error-message"
import { isApiErrorResponse } from "@/lib/api/client"
import { listWebhookDeliveries } from "@/lib/api/webhooks"
import { requireAuth } from "@/lib/auth"

export default async function WebhookDeliveryDetailPage({
  params,
}: {
  params: Promise<{ deliveryId: string }>
}) {
  const { deliveryId } = await params
  const session = await requireAuth()
  const response = await listWebhookDeliveries(session.accessToken)
  if (isApiErrorResponse(response)) {
    return (
      <ErrorMessage
        title="Webhook delivery"
        description="Inspect payload and retry delivery."
        message={response.message}
      />
    )
  }
  const delivery =
    response.data.find((item) => item.delivery_id === deliveryId) ??
    response.data[0]
  const deliveryLabel = delivery?.delivery_id ?? "Delivery"
  const eventLabel = delivery?.event ?? "unknown"
  const statusLabel = delivery?.status ?? "unknown"
  const createdAtLabel = delivery?.createdAt ?? "-"

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Webhook Deliveries", href: AdminLinks.webhookDeliveries },
          { label: deliveryLabel },
        ]}
      />
      <PageHeader
        title={`Delivery ${deliveryLabel}`}
        description="Inspect payload and retry delivery."
        actions={<Button>Retry delivery</Button>}
      />

      <Card>
        <CardContent className="grid gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span>Event</span>
            <span className="font-medium">{eventLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Status</span>
            <StatusBadge status={statusLabel} />
          </div>
          <div className="flex items-center justify-between">
            <span>Timestamp</span>
            <span className="text-muted-foreground">{createdAtLabel}</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 text-sm">
          <div className="font-medium">Payload preview</div>
          <div className="rounded-md border border-border/60 bg-muted/40 p-4 font-mono text-xs text-muted-foreground">
            {`{ "event": "${eventLabel}", "deliveryId": "${deliveryLabel}", "status": "${statusLabel}" }`}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
