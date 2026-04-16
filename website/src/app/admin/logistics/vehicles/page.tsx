import { AdminRoute } from "@/lib/routes/admin"
import { PageHeader } from "@/components/layout/page-header"
import { ImportVehiclesDialog } from "@/components/vehicles/import-vehicles-dialog"
import { VehicleDialog } from "@/components/vehicles/vehicle-dialog"
import { VehiclesTable } from "@/components/vehicles/vehicles-table"
import { isApiErrorResponse } from "@/lib/api/client"
import { listTags } from "@/lib/api/tags"
import { listVehicleTypes } from "@/lib/api/vehicle-types"
import { listVehicles } from "@/lib/api/vehicles"
import { getLocationLabel } from "@/lib/address"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

type VehiclesPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
    tag_id?: string | string[]
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
  const rawTagId = Array.isArray(params.tag_id) ? params.tag_id[0] : params.tag_id
  const rawSortBy = Array.isArray(params.sort_by) ? params.sort_by[0] : params.sort_by
  const rawSortDir = Array.isArray(params.sort_dir) ? params.sort_dir[0] : params.sort_dir
  const page = rawPage ? parseInt(rawPage, 10) : 1
  const tagId = rawTagId?.trim() || ""
  const sortBy = normalizeSortBy(rawSortBy)
  const sortDir = normalizeSortDir(rawSortDir)
  const per_page = 100;
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)
  const defaultImportMerchantId = merchantId ?? session.selected_merchant?.merchant_id ?? null
  const canLoad = session.user.role === "super_admin" || Boolean(merchantId)
  const vehicleTypesResponse = await listVehicleTypes(session.accessToken, { per_page: 200 })
  const vehicleTypes =
    !isApiErrorResponse(vehicleTypesResponse)
      ? vehicleTypesResponse.data
      : []
  const tagsResponse = merchantId
    ? await listTags(session.accessToken, { merchant_id: merchantId, per_page: 100 })
    : null
  const tags =
    tagsResponse && !isApiErrorResponse(tagsResponse)
      ? tagsResponse.data
      : []
  const response = canLoad
    ? await listVehicles(session.accessToken, {
        page: page ?? 1,
        per_page: per_page ?? 100,
        merchant_id: merchantId,
        tag_id: tagId || undefined,
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
          selection_id: vehicleRef ?? "",
          href: vehicleRef ? AdminRoute.vehicleDetails(vehicleRef) : "",
          last_known_location: getLocationLabel(vehicle.last_location_address),
          is_on_a_run_label: vehicle.is_on_a_run ? "active" : "inactive",
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
      <VehiclesTable
        accessToken={session.accessToken}
        merchantId={merchantId ?? null}
        rows={rows}
        meta={tableMeta}
        loadingError={loading_error}
        vehicleTypes={vehicleTypes}
        filters={[
          {
            key: "tag",
            label: "Tag",
            value: tagId,
            url_param_name: "tag_id",
            options: tags.map((tag) => ({
              label: tag.name,
              value: tag.tag_id,
            })),
          },
        ]}
      />
    </div>
  )
}
