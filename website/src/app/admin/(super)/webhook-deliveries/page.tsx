import { AdminRoute } from "@/lib/routes/admin"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { isApiErrorResponse } from "@/lib/api/client"
import { listWebhookDeliveries } from "@/lib/api/webhooks"
import { requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

type WebhookDeliveriesPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
  }>
}

export default async function WebhookDeliveriesPage({
  searchParams,
}: WebhookDeliveriesPageProps) {
  const params = (await searchParams) ?? {}
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const session = await requireAuth()
  const response = await listWebhookDeliveries(session.accessToken, { page })
  const isError = isApiErrorResponse(response)
  const loading_error = isError ? response.message : null
  const rows = isError
    ? []
    : response.data.map((delivery) => ({
        ...delivery,
        href: delivery.delivery_id
          ? AdminRoute.webhookDeliveryDetails(delivery.delivery_id)
          : "",
      }))
  const tableMeta = isError ? undefined : normalizeTableMeta(response.meta)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhook deliveries"
        description="Inspect delivery logs, retries, and payload status."
      />
      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        searchKeys={["event", "delivery_id"]}
        columns={[
          { key: "delivery_id", label: "Delivery" },
          { key: "event", label: "Event" },
          {
            key: "status",
            label: "Status",
            type: "status",
          },
          { key: "createdAt", label: "Timestamp" },
        ]}
        rowActions={[
          { label: "View", hrefKey: "href" },
          { label: "Retry" },
        ]}
      />
    </div>
  )
}
