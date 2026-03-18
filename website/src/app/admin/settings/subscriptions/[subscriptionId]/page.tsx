import { ErrorMessage } from "@/components/common/error-message"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { DataTable } from "@/components/common/data-table"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/common/status-badge"
import { WebhookSubscriptionDetailActions } from "@/components/webhooks/webhook-subscription-detail-actions"
import { isApiErrorResponse } from "@/lib/api/client"
import { getWebhookSubscription } from "@/lib/api/webhooks"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { AdminLinks } from "@/lib/routes/admin"
import { normalizeTableMeta } from "@/lib/table"

type WebhookSubscriptionDetailPageProps = {
  params: Promise<{ subscriptionId: string }>
  searchParams?: Promise<{
    page?: string | string[]
  }>
}

function toResponsePreview(value?: string | null): string {
  if (!value) return "-"
  const compact = value.replace(/\s+/g, " ").trim()
  if (compact.length <= 120) return compact
  return `${compact.slice(0, 117)}...`
}

export default async function WebhookSubscriptionDetailPage({
  params,
  searchParams,
}: WebhookSubscriptionDetailPageProps) {
  const { subscriptionId } = await params
  const query = (await searchParams) ?? {}
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)
  const canLoad = session.user.role === "super_admin" || Boolean(merchantId)

  if (!canLoad) {
    return (
      <ErrorMessage
        title="Webhook subscription"
        description="Inspect endpoint status and delivery attempts."
        message="Select a merchant to view this webhook subscription."
      />
    )
  }

  const response = await getWebhookSubscription(subscriptionId, session.accessToken, {
    page,
    merchant_id: merchantId,
  })
  if (isApiErrorResponse(response)) {
    return (
      <ErrorMessage
        title="Webhook subscription"
        description="Inspect endpoint status and delivery attempts."
        message={response.message}
      />
    )
  }

  const subscription = response.data.subscription
  const rows = (response.data.deliveries ?? []).map((delivery) => ({
    ...delivery,
    deliveryId: delivery.webhook_delivery_id ?? delivery.delivery_id ?? "-",
    eventDisplay: delivery.event_type ?? delivery.event ?? "-",
    responseCodeDisplay: delivery.last_response_code ?? "-",
    responseBodyDisplay: toResponsePreview(delivery.last_response_body),
    attemptedAt: delivery.last_attempt_at ?? delivery.created_at ?? delivery.createdAt,
  }))
  const tableMeta = normalizeTableMeta(response.meta)

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Webhook Subscriptions", href: AdminLinks.webhookSubscriptions },
          { label: String(subscription.subscription_id) },
        ]}
      />
      <PageHeader
        title={`Subscription ${subscription.subscription_id}`}
        description="Review webhook attempts and response outcomes for this endpoint."
        actions={
          <WebhookSubscriptionDetailActions
            subscriptionId={String(subscription.subscription_id)}
            accessToken={session.accessToken}
            backHref={AdminLinks.webhookSubscriptions}
            initialUrl={subscription.url}
            initialEventTypes={subscription.event_types ?? []}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">Endpoint URL</div>
            <div className="break-all font-medium">{subscription.url}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Status</span>
              <StatusBadge status={subscription.status} />
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs text-muted-foreground">Events</span>
              <span className="text-right text-xs">
                {(subscription.event_types ?? []).join(", ") || "-"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={rows}
        meta={tableMeta}
        searchKeys={["deliveryId", "eventDisplay", "responseBodyDisplay"]}
        columns={[
          { key: "deliveryId", label: "Delivery ID" },
          { key: "eventDisplay", label: "Event" },
          { key: "status", label: "Status", type: "status" },
          { key: "attempts", label: "Attempts" },
          { key: "responseCodeDisplay", label: "Response Code" },
          { key: "responseBodyDisplay", label: "Response Body" },
          { key: "attemptedAt", label: "Last Attempt", type: "date_time" },
        ]}
        emptyMessage="No delivery attempts found for this subscription."
      />
    </div>
  )
}
