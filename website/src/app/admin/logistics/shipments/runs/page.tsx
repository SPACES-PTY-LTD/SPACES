import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/common/data-table"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/layout/page-header"
import { isApiErrorResponse } from "@/lib/api/client"
import { listRuns } from "@/lib/api/runs"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { AdminRoute } from "@/lib/routes/admin"
import { normalizeTableMeta } from "@/lib/table"
import type { Location, Run } from "@/lib/types"

function single(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

function duration(value?: number | null) {
  if (typeof value !== "number") return "-"
  const minutes = Math.round(value / 60)
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`
}

function distance(run: Run) {
  const value = run.distance_km ?? run.odometer_distance_km
  if (typeof value !== "number") return "-"
  const source = run.distance_source === "gps" ? " (GPS)" : ""
  return `${value.toLocaleString("en-ZA", { maximumFractionDigits: 2 })} km${source}`
}

function locationName(location?: Location | null) {
  return location?.name || location?.company || location?.full_address || "-"
}

export default async function RunsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)
  const params = searchParams ? await searchParams : {}
  const status = single(params.status)
  const from = single(params.from)
  const to = single(params.to)
  const query = single(params.q)
  const page = Number(single(params.page) ?? 1)
  const perPage = Number(single(params.per_page) ?? 20)
  const canLoad = session.user.role === "super_admin" || Boolean(merchantId)
  const response = canLoad
    ? await listRuns(session.accessToken, {
        merchant_id: merchantId,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        search: query || undefined,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        per_page: Number.isFinite(perPage) ? perPage : 20,
      })
    : null
  const runs = response && !isApiErrorResponse(response) ? response.data : []
  const error = !canLoad
    ? "Select a merchant to view runs."
    : response && isApiErrorResponse(response)
      ? response.message
      : null

  const rows = runs.map((run) => ({
    ...run,
    href: AdminRoute.runDetails(run.run_id),
    runDuration: duration(run.duration_seconds),
    runDistance: distance(run),
    originName: locationName(run.origin),
    destinationName: locationName(run.destination),
    driverName: run.driver?.name || "Unassigned",
    vehicleName: run.vehicle?.plate_number || run.vehicle?.ref_code || "Unassigned",
    effectiveStart: run.started_at ?? run.planned_start_at ?? run.created_at,
  }))

  return (
    <div className="space-y-6">
      <PageHeader title="Runs" description="Review active and historical delivery runs." />
      <form className="flex max-w-xl gap-2" action="/admin/logistics/shipments/runs">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {from ? <input type="hidden" name="from" value={from} /> : null}
        {to ? <input type="hidden" name="to" value={to} /> : null}
        <input type="hidden" name="per_page" value={String(perPage)} />
        <Input name="q" defaultValue={query} placeholder="Search run, driver, vehicle, service area…" />
        <Button type="submit">Search</Button>
      </form>
      <DataTable
        data={rows}
        meta={response && !isApiErrorResponse(response) ? normalizeTableMeta(response.meta) : undefined}
        loading_error={error}
        emptyMessage="No runs match the selected filters."
        width="1500px"
        filters={[
          {
            key: "status",
            label: "Status",
            value: status ?? "",
            url_param_name: "status",
            options: [
              { label: "Draft", value: "draft" },
              { label: "Dispatched", value: "dispatched" },
              { label: "In progress", value: "in_progress" },
              { label: "Completed", value: "completed" },
              { label: "Cancelled", value: "cancelled" },
            ],
          },
          { key: "from", label: "Run date from", type: "date", value: from ?? "", url_param_name: "from" },
          { key: "to", label: "Run date to", type: "date", value: to ?? "", url_param_name: "to" },
          {
            key: "per_page",
            label: "Per page",
            value: String(perPage),
            url_param_name: "per_page",
            options: [10, 20, 50, 100].map((value) => ({ label: String(value), value: String(value) })),
          },
        ]}
        columns={[
          { key: "run_id", label: "Run ID", link: "href", className: "w-[260px]" },
          { key: "status", label: "Status", type: "status", link: "href", className: "w-[130px]" },
          { key: "effectiveStart", label: "Start", type: "date_time", link: "href", className: "w-[170px]" },
          { key: "runDuration", label: "Duration", link: "href", className: "w-[120px]" },
          { key: "runDistance", label: "Distance", link: "href", className: "w-[140px]" },
          { key: "shipment_count", label: "Shipments", link: "href", className: "w-[110px]" },
          { key: "originName", label: "Origin", link: "href", className: "w-[220px]" },
          { key: "destinationName", label: "Destination", link: "href", className: "w-[220px]" },
          { key: "driverName", label: "Driver", link: "href", className: "w-[160px]" },
          { key: "vehicleName", label: "Vehicle", link: "href", className: "w-[140px]" },
        ]}
      />
    </div>
  )
}
