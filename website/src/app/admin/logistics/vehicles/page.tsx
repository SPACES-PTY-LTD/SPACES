import { AdminRoute } from "@/lib/routes/admin"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { ImportVehiclesDialog } from "@/components/vehicles/import-vehicles-dialog"
import { VehicleDialog } from "@/components/vehicles/vehicle-dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import { listVehicles } from "@/lib/api/vehicles"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

type VehiclesPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
    sort_by?: string | string[]
    sort_dir?: string | string[]
  }>
}

function normalizeSortBy(value?: string) {
  const allowed = new Set(["created_at", "plate_number", "type", "make", "model", "is_active"])
  return allowed.has(value ?? "") ? value ?? "created_at" : "created_at"
}

function normalizeSortDir(value?: string) {
  return value === "asc" ? "asc" : "desc"
}

export default async function VehiclesPage({ searchParams }: VehiclesPageProps) {
  const params = (await searchParams) ?? {}
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const rawSortBy = Array.isArray(params.sort_by) ? params.sort_by[0] : params.sort_by
  const rawSortDir = Array.isArray(params.sort_dir) ? params.sort_dir[0] : params.sort_dir
  const page = rawPage ? parseInt(rawPage, 10) : 1
  const sortBy = normalizeSortBy(rawSortBy)
  const sortDir = normalizeSortDir(rawSortDir)
  const per_page = 100;
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)
  const defaultImportMerchantId = merchantId ?? session.selected_merchant?.merchant_id ?? null
  const canLoad = session.user.role === "super_admin" || Boolean(merchantId)
  const response = canLoad
    ? await listVehicles(session.accessToken, {
        page: page ?? 1,
        per_page: per_page ?? 100,
        merchant_id: merchantId,
        sort_by: sortBy,
        sort_dir: sortDir,
      })
    : null
  const isError = response ? isApiErrorResponse(response) : false
  const errorMessage =
    response && isApiErrorResponse(response) ? response.message : null
  const vehicles = response && !isApiErrorResponse(response) ? response : null
  const loading_error = canLoad
    ? isError
      ? errorMessage
      : null
    : "Select a merchant to view vehicles."
  const rows = isError
    ? []
    : (vehicles?.data ?? []).map((vehicle) => {
        const vehicleRef = vehicle.vehicle_id ?? vehicle.vehicle_uuid

        return {
          ...vehicle,
          href: vehicleRef ? AdminRoute.vehicleDetails(vehicleRef) : "",
          status_label:
            vehicle.status ??
            (vehicle.is_active === true
              ? "active"
              : vehicle.is_active === false
                ? "inactive"
                : "unknown"),
        }
      })
  const tableMeta = isError ? undefined : normalizeTableMeta(vehicles?.meta)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicles"
        description="Manage vehicle details and availability."
        actions={
          <div className="flex items-center gap-2">
            <ImportVehiclesDialog
              accessToken={session.accessToken}
              merchantId={defaultImportMerchantId}
              lockMerchant={session.user.role !== "super_admin"}
            />
            <VehicleDialog
              accessToken={session.accessToken}
              merchantId={defaultImportMerchantId}
            />
          </div>
        }
      />
      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        searchKeys={["plate_number", "make", "model", "type.name"]}
        columns={[
          { key: "plate_number", label: "Plate", link: "href" },
          { key: "type.name", label: "Type", link: "href" },
          { key: "make", label: "Make", link: "href" },
          { key: "model", label: "Model", link: "href" },
          { key: "status_label", label: "Status", type: "status", link: "href" },
        ]}
        rowActions={[
          { label: "View", hrefKey: "href" },
          { label: "Edit" },
          { label: "Delete", variant: "destructive" },
        ]}
        enableSorting
        sortableColumns={["plate_number", "type.name", "make", "model", "status_label"]}
        sortKeyMap={{ "type.name": "type", status_label: "is_active" }}
      />
    </div>
  )
}
