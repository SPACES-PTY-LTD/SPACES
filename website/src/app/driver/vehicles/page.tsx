import { CreateResourceDialog } from "@/components/common/create-resource-dialog"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { isApiErrorResponse } from "@/lib/api/client"
import { listDriverVehicles } from "@/lib/api/driver"
import { requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

type DriverVehiclesPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
  }>
}

export default async function DriverVehiclesPage({
  searchParams,
}: DriverVehiclesPageProps) {
  const params = (await searchParams) ?? {}
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const session = await requireAuth()
  const response = await listDriverVehicles(session.accessToken, { page })
  const isError = isApiErrorResponse(response)
  const loading_error = isError ? response.message : null
  const rows = isError
    ? []
    : response.data.map((vehicle) => ({
        ...vehicle,
        href: `/driver/vehicles/${vehicle.vehicle_id}`,
      }))
  const tableMeta = isError ? undefined : normalizeTableMeta(response.meta)

  return (
    <div className="space-y-6">
      <PageHeader
        title="My vehicles"
        description="Maintain vehicle details for assignments."
        actions={
          <CreateResourceDialog
            title="Add vehicle"
            triggerLabel="Add vehicle"
            fields={[
              { name: "plate", label: "Plate", required: true },
              { name: "type", label: "Type", required: true },
            ]}
          />
        }
      />
      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        columns={[
          { key: "plate", label: "Plate" },
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
      />
    </div>
  )
}
