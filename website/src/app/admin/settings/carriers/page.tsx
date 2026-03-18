import { AdminRoute } from "@/lib/routes/admin"
import { CreateResourceDialog } from "@/components/common/create-resource-dialog"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { isApiErrorResponse } from "@/lib/api/client"
import { listCarriers } from "@/lib/api/carriers"
import { requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

type CarriersPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
    sort_by?: string | string[]
    sort_dir?: string | string[]
  }>
}

function normalizeSortBy(value?: string) {
  const allowed = new Set(["created_at", "name", "code", "type", "enabled"])
  return allowed.has(value ?? "") ? value ?? "created_at" : "created_at"
}

function normalizeSortDir(value?: string) {
  return value === "asc" ? "asc" : "desc"
}

export default async function CarriersPage({ searchParams }: CarriersPageProps) {
  const params = (await searchParams) ?? {}
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const rawSortBy = Array.isArray(params.sort_by) ? params.sort_by[0] : params.sort_by
  const rawSortDir = Array.isArray(params.sort_dir) ? params.sort_dir[0] : params.sort_dir
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const sortBy = normalizeSortBy(rawSortBy)
  const sortDir = normalizeSortDir(rawSortDir)
  const session = await requireAuth()
  const response = await listCarriers(session.accessToken, {
    page,
    sort_by: sortBy,
    sort_dir: sortDir,
  })
  const isError = isApiErrorResponse(response)
  const loading_error = isError ? response.message : null
  const rows = isError
    ? []
    : response.data.map((carrier) => ({
        ...carrier,
        href: AdminRoute.carrierDetails(carrier.carrier_id),
      }))
  const tableMeta = isError ? undefined : normalizeTableMeta(response.meta)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carriers"
        description="Manage carrier performance and availability."
        actions={
          <CreateResourceDialog
            title="Create carrier"
            triggerLabel="New carrier"
            fields={[
              { name: "name", label: "Carrier name", required: true },
              {
                name: "email",
                label: "Contact email",
                type: "email",
                required: true,
              },
            ]}
          />
        }
      />
      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        searchKeys={["name", "code", "type"]}
        columns={[
          { key: "name", label: "Carrier" },
          { key: "code", label: "Code" },
          { key: "type", label: "Type" },
          {
            key: "status",
            label: "Status",
            type: "status",
          },
        ]}
        rowActions={[
          { label: "View", hrefKey: "href" },
          { label: "Edit" },
          { label: "Delete", variant: "destructive" },
        ]}
        enableSorting
        sortableColumns={["name", "code", "type"]}
      />
    </div>
  )
}
