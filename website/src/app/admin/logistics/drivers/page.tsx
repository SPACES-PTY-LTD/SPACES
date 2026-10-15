import { AdminRoute } from "@/lib/routes/admin"
import { ExportableDataTable } from "@/components/common/exportable-data-table"
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
    per_page?: string | string[]
    search?: string | string[]
    is_active?: string | string[]
    has_vehicle?: string | string[]
    source?: string | string[]
    sort_by?: string | string[]
    sort_dir?: string | string[]
  }>
}

export default async function DriversPage({ searchParams }: DriversPageProps) {
  const params = (await searchParams) ?? {}
  const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value
  const parsedPerPage = Number(first(params.per_page) ?? 15)
  const perPage = Number.isInteger(parsedPerPage) && parsedPerPage > 0 && parsedPerPage <= 100
    ? parsedPerPage : 15
  const search = first(params.search)?.trim().slice(0, 255) || undefined
  const rawActive = first(params.is_active)
  const isActive = rawActive === "1" ? 1 : rawActive === "0" ? 0 : undefined
  const rawHasVehicle = first(params.has_vehicle)
  const hasVehicle = rawHasVehicle === "1" ? 1 : rawHasVehicle === "0" ? 0 : undefined
  const rawSource = first(params.source)
  const source = rawSource === "imported" || rawSource === "manual" ? rawSource : undefined
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const rawSortBy = Array.isArray(params.sort_by) ? params.sort_by[0] : params.sort_by
  const rawSortDir = Array.isArray(params.sort_dir) ? params.sort_dir[0] : params.sort_dir
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const allowedSorts = ["created_at", "name", "email", "telephone", "intergration_id", "is_active", "imported_at", "vehicles"]
  const sortBy = allowedSorts.includes(rawSortBy ?? "") ? rawSortBy : undefined
  const sortDir = rawSortDir === "asc" || rawSortDir === "desc" ? rawSortDir : undefined
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)
  const defaultImportMerchantId = merchantId ?? session.selected_merchant?.merchant_id ?? null
  const canLoad = session.user.role === "super_admin" || Boolean(merchantId)
  const response = canLoad
    ? await listDrivers(session.accessToken, {
        merchant_id: merchantId,
        page,
        per_page: perPage,
        search,
        is_active: isActive,
        has_vehicle: hasVehicle,
        source,
        sort_by: sortBy,
        sort_direction: sortDir,
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
        is_active: driver.is_active ? "active" : "inactive",
        document_status: driver.document_summary?.status ?? "unknown",
        missing_documents: driver.document_summary?.missing.join(", ") || "—",
        expired_documents: driver.document_summary?.expired.join(", ") || "—",
        documents_href: `${AdminRoute.driverDetails(driver.driver_id)}#files`,
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
      <ExportableDataTable
        resource="drivers"
        idKey="driver_id"
        label="drivers"
        accessToken={session.accessToken}
        merchantId={merchantId ?? null}
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        stickyColumns={{ leading: 1 }}
        enableSorting
        sortableColumns={["name", "email", "is_active", "vehicles"]}
        serverSearchParam="search"
        filters={[
          {
            key: "is_active", label: "Status", url_param_name: "is_active",
            options: [{ label: "Active", value: "1" }, { label: "Inactive", value: "0" }],
          },
          {
            key: "vehicles", label: "Vehicle assignment", url_param_name: "has_vehicle",
            options: [{ label: "Assigned", value: "1" }, { label: "Unassigned", value: "0" }],
          },
          {
            key: "source", label: "Source", url_param_name: "source",
            options: [{ label: "Imported", value: "imported" }, { label: "Manual", value: "manual" }],
          },
        ]}
        columns={[
          { key: "name", label: "Driver", className: "min-w-56", link: "href", type: "driver", avatarKey: "profile_photo_url" },
          { key: "email", label: "Email", link: "href" },
          {
            key: "is_active",
            label: "Status",
            type: "status",
          },
          { key: "document_status", label: "Document status", type: "status" },
          { key: "missing_documents", label: "Missing documents", link: "documents_href", className: "min-w-48 whitespace-normal" },
          { key: "expired_documents", label: "Expired documents", link: "documents_href", className: "min-w-48 whitespace-normal" },
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
