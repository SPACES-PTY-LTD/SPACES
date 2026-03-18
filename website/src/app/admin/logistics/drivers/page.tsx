import { AdminRoute } from "@/lib/routes/admin"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { CreateDriverDialog } from "@/components/drivers/create-driver-dialog"
import { ImportDriversDialog } from "@/components/drivers/import-drivers-dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import { listDrivers } from "@/lib/api/drivers"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

type DriversPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
    sort_by?: string | string[]
    sort_dir?: string | string[]
  }>
}

export default async function DriversPage({ searchParams }: DriversPageProps) {
  const params = (await searchParams) ?? {}
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const rawSortBy = Array.isArray(params.sort_by) ? params.sort_by[0] : params.sort_by
  const rawSortDir = Array.isArray(params.sort_dir) ? params.sort_dir[0] : params.sort_dir
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const sortBy = rawSortBy?.trim() ? rawSortBy.trim() : undefined
  const sortDir = rawSortDir === "asc" || rawSortDir === "desc" ? rawSortDir : undefined
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)
  const defaultImportMerchantId = merchantId ?? session.selected_merchant?.merchant_id ?? null
  const canLoad = session.user.role === "super_admin" || Boolean(merchantId)
  const response = canLoad
    ? await listDrivers(session.accessToken, {
        merchant_id: merchantId,
        page,
        sort_by: sortBy,
        sort_dir: sortDir,
      })
    : null
  const isError = response ? isApiErrorResponse(response) : false
  const errorMessage =
    response && isApiErrorResponse(response) ? response.message : null
  const drivers = response && !isApiErrorResponse(response) ? response.data : []
  const loading_error = canLoad
    ? isError
      ? errorMessage
      : null
    : "Select a merchant to view drivers."
  const rows = isError
    ? []
    : drivers.map((driver) => ({
        ...driver,
        is_active: driver.is_active ? "Active" : "Inactive",
        href: AdminRoute.driverDetails(driver.driver_id),
      }))
  const tableMeta =
    response && !isApiErrorResponse(response)
      ? normalizeTableMeta(response.meta)
      : undefined    

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drivers"
        description="Manage driver availability and vehicle assignments."
        actions={
          <div className="flex items-center gap-2">
            <ImportDriversDialog
              accessToken={session.accessToken}
              merchantId={defaultImportMerchantId}
              lockMerchant={session.user.role !== "super_admin"}
            />
            <CreateDriverDialog
              accessToken={session.accessToken}
              role={session.user.role}
            />
          </div>
        }
      />
      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        enableSorting
        sortableColumns={["name", "email", "is_active", "vehicles"]}
        searchKeys={["name", "email"]}
        columns={[
          { key: "image", label: "Pic", link: "href", type: "image", size: "sm" },
          { key: "name", label: "Driver", link: "href" },
          { key: "email", label: "Email", link: "href" },
          {
            key: "is_active",
            label: "Active",
          },
          { key: "vehicles", label: "Vehicles", type: "count_array" },
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
