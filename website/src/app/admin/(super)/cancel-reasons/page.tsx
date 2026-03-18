import { AdminRoute } from "@/lib/routes/admin"
import { CreateResourceDialog } from "@/components/common/create-resource-dialog"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { isApiErrorResponse } from "@/lib/api/client"
import { listCancelReasons } from "@/lib/api/cancel-reasons"
import { requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

type CancelReasonsPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
  }>
}

export default async function CancelReasonsPage({ searchParams }: CancelReasonsPageProps) {
  const params = (await searchParams) ?? {}
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const session = await requireAuth()
  const response = await listCancelReasons(session.accessToken, { page })
  const isError = isApiErrorResponse(response)
  const loading_error = isError ? response.message : null
  const rows = isError
    ? []
    : (response.data ?? []).map((reason) => ({
        ...reason,
        enabled: reason.enabled ? "Enabled" : "Disabled",
        href: AdminRoute.cancelReasonDetails(reason.cancel_reason_id),
      }))
  const tableMeta = isError ? undefined : normalizeTableMeta(response.meta)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cancel reasons"
        description="Standardize cancellation and exception reporting."
        actions={
          <CreateResourceDialog
            title="Create cancel reason"
            triggerLabel="New reason"
            fields={[
              { name: "label", label: "Label", required: true },
              { name: "code", label: "Code", required: true },
            ]}
          />
        }
      />
      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        searchKeys={["label", "code"]}
        columns={[
          { key: "title", label: "Label" },
          { key: "code", label: "Code" },
          {
            key: "enabled",
            label: "Enabled",
            type: "status",
          },
        ]}
        rowActions={[
          { label: "View", hrefKey: "href" },
          { label: "Edit" },
          { label: "Delete", variant: "destructive" },
        ]}
      />
    </div>
  )
}
