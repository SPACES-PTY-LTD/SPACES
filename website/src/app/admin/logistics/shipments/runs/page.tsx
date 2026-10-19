import { CreateRunDrawer } from "@/components/runs/create-run-drawer"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/common/data-table"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/layout/page-header"
import { isApiErrorResponse } from "@/lib/api/client"
import { listRuns } from "@/lib/api/runs"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { AdminRoute } from "@/lib/routes/admin"
import { runSpeedingCount } from "@/lib/run-speeding-count"
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
  const sortBy = single(params.sort_by)
  const sortDir = single(params.sort_dir) === "desc" ? "desc" : "asc"
  const status = single(params.status)
  const from = single(params.from)
  const to = single(params.to)
  const query = single(params.q)
  const page = Number(single(params.page) ?? 1)
  const perPage = Number(single(params.per_page) ?? 20)
  const canLoad = session.user.role === "super_admin" || Boolean(merchantId)
  const response = canLoad
    ? await listRuns(session.accessToken, {
        summary: true,
        merchant_id: merchantId,
        sort_by: sortBy,
        sort_dir: sortDir,
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
    speeding_alert_count: runSpeedingCount(run),
    href: AdminRoute.runDetails(run.run_id),
    endRequestStatus: run.end_request?.status === "pending" ? "pending_approval" : "",
    additionalCostsLabel: run.additional_cost_totals?.length
      ? run.additional_cost_totals.map(({ currency, amount }) => `${currency}\u00a0${amount}`).join("\n")
      : "No costs",
    runDuration: duration(run.duration_seconds),
    runDistance: distance(run),
    originName: locationName(run.origin),
    destinationName: locationName(run.destination),
    driverName: run.driver?.name || "Unassigned",
    vehicleName: run.vehicle?.plate_number || run.vehicle?.ref_code || "Unassigned",
    effectiveStart: run.started_at ?? run.planned_start_at ?? run.created_at,
  }))

  return (
    <div className="space-y-6 [&_td:nth-child(8)]:whitespace-pre-line [&_td:nth-child(8)]:tabular-nums">
      <PageHeader className="flex-row items-start [&>div:last-child]:shrink-0" title="Runs" description="Review active and historical delivery runs." actions={
        <CreateRunDrawer key={`${session.user.uuid ?? session.user.email}:${session.selected_merchant?.merchant_id ?? ""}:${single(params.environment_id) ?? ""}`} isSuperAdmin={session.user.role === "super_admin"} token={session.accessToken} userId={session.user.uuid ?? session.user.email}
          merchant={session.selected_merchant}
          environmentId={single(params.environment_id)} />
      } />
      <form className="flex max-w-xl gap-2" action="/admin/logistics/shipments/runs">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {from ? <input type="hidden" name="from" value={from} /> : null}
        {to ? <input type="hidden" name="to" value={to} /> : null}
        {sortBy ? <input type="hidden" name="sort_by" value={sortBy} /> : null}
        {sortBy ? <input type="hidden" name="sort_dir" value={sortDir} /> : null}
        <input type="hidden" name="per_page" value={String(perPage)} />
        <Input name="q" defaultValue={query} placeholder="Search run, driver, vehicle, service area…" />
        <Button type="submit">Search</Button>
      </form>
      <DataTable
        data={rows}
        accessToken={session.accessToken}
        enableSorting
        stickyColumns={{ leading: 3 }}
        sortableColumns={[
          "system_run_id", "status", "effectiveStart", "runDuration", "runDistance",
          "additionalCostsLabel", "shipment_count", "originName", "destinationName",
          "driverName", "vehicleName",
        ]}
        sortKeyMap={{
          effectiveStart: "start",
          runDuration: "duration",
          runDistance: "distance",
          additionalCostsLabel: "additional_costs",
          originName: "origin",
          destinationName: "destination",
          driverName: "driver",
          vehicleName: "vehicle",
        }}
        meta={response && !isApiErrorResponse(response) ? normalizeTableMeta(response.meta) : undefined}
        loading_error={error}
        emptyMessage="No runs match the selected filters."
        width="2050px"
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
          { key: "system_run_id", label: "Run ID", link: "href", className: "w-[100px]" },
          { key: "status", label: "Status", type: "status", link: "href", className: "w-[130px]" },
          { key: "attention", label: "Attention", type: "shipment_attention", className: "w-[120px]" },
          { key: "endRequestStatus", label: "End request", type: "status", link: "href", className: "w-[170px]" },
          { key: "effectiveStart", label: "Start", type: "date_time", link: "href", className: "w-[170px]" },
          { key: "runDuration", label: "Duration", link: "href", className: "w-[120px]" },
          { key: "runDistance", label: "Distance", description: "Distance uses the end odometer reading minus the start reading when both are available (shown without a label). Otherwise, it is calculated from recorded GPS points and marked (GPS). A dash means neither source has enough data.", link: "href", className: "w-[140px]" },
          { key: "additionalCostsLabel", label: "Additional costs", link: "href", className: "w-[180px]" },
          { key: "shipment_count", label: "Shipments", link: "href", className: "w-[110px]" },
          { key: "delivery_note_files", label: "Has Delivery Note File", type: "run_delivery_note_files", className: "w-[240px]" },
          { key: "originName", label: "Origin", link: "href", className: "w-[220px]" },
          { key: "destinationName", label: "Destination", link: "href", className: "w-[220px]" },
          { key: "driverName", label: "Driver", type: "driver", avatarKey: "driver.profile_photo_url", link: "href", className: "w-[160px]" },
          { key: "vehicleName", label: "Vehicle", link: "href", className: "w-[140px]" },
        ]}
      />
    </div>
  )
}
