import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { WebhookSubscriptionCreateDialog } from "@/components/webhooks/webhook-subscription-create-dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import { listWebhookSubscriptions } from "@/lib/api/webhooks"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { AdminRoute } from "@/lib/routes/admin"
import { normalizeTableMeta } from "@/lib/table"

type WebhookSubscriptionsPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
  }>
}

export default async function WebhookSubscriptionsPage({
  searchParams,
}: WebhookSubscriptionsPageProps) {
  const params = (await searchParams) ?? {}
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)
  const canLoad = session.user.role === "super_admin" || Boolean(merchantId)
  const response = canLoad
    ? await listWebhookSubscriptions(session.accessToken, {
        page,
        merchant_id: merchantId,
      })
    : null
  const isError = response ? isApiErrorResponse(response) : false
  const errorResponse = response && isApiErrorResponse(response) ? response : null
  const successResponse = response && !isApiErrorResponse(response) ? response : null
  const loading_error = canLoad
    ? isError
      ? errorResponse?.message ?? "Unable to load subscriptions."
      : null
    : "Select a merchant to view webhook subscriptions."
  const rows = successResponse
    ? successResponse.data.map((subscription) => ({
        ...subscription,
        eventsDisplay: (subscription.event_types ?? []).join(", "),
        href: AdminRoute.webhookSubscriptionDetails(subscription.subscription_id),
      }))
    : []
  const tableMeta =
    successResponse
      ? normalizeTableMeta(successResponse.meta)
      : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        description="Manage outbound webhook endpoints and test deliveries."
        actions={
          <WebhookSubscriptionCreateDialog
            accessToken={session.accessToken}
            merchantId={merchantId}
          />
        }
      />
      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        searchKeys={["url"]}
        columns={[
          { key: "url", label: "Endpoint", link: "href" },
          { key: "eventsDisplay", label: "Events" },
          {
            key: "status",
            label: "Status",
            type: "status",
          },
          { key: "created_at", label: "Created", type: "date_time" },
        ]}
        
      />
    </div>
  )
}
