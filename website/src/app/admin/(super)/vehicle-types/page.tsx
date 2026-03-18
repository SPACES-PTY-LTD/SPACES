import { AdminRoute } from "@/lib/routes/admin"
import { CreateResourceDialog } from "@/components/common/create-resource-dialog"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { isApiErrorResponse } from "@/lib/api/client"
import { listVehicleTypes } from "@/lib/api/vehicle-types"
import { requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

type VehicleTypesPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
  }>
}

export default async function VehicleTypesPage({ searchParams }: VehicleTypesPageProps) {
  const params = (await searchParams) ?? {}
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const session = await requireAuth()
  const response = await listVehicleTypes(session.accessToken, { page })
  const isError = isApiErrorResponse(response)
  const loading_error = isError ? response.message : null
  const rows = isError
    ? []
    : response.data.map((vehicleType) => ({
        ...vehicleType,
        payloadDisplay: `${vehicleType.payloadKg} kg`,
        href: AdminRoute.vehicleTypeDetails(vehicleType.vehicle_type_id),
      }))
  const tableMeta = isError ? undefined : normalizeTableMeta(response.meta)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle types"
        description="Define payload ranges and default equipment classes."
        actions={
          <CreateResourceDialog
            title="Create vehicle type"
            triggerLabel="New vehicle type"
            fields={[
              { name: "name", label: "Name", required: true },
              { name: "payload", label: "Payload (kg)", required: true },
            ]}
          />
        }
      />
      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        searchKeys={["name"]}
        columns={[
          { key: "name", label: "Type" },
          { key: "payloadDisplay", label: "Payload (kg)" },
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
      />
    </div>
  )
}
