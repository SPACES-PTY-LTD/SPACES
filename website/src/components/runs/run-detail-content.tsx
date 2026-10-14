import { NewShipmentButton } from "@/components/shipments/new-shipment-button"
import { AdminRunActions } from "@/components/runs/admin-run-actions"
import { RunEndReview } from "@/components/runs/run-end-review"
import { AdditionalCosts } from "@/components/costs/additional-costs"
import Link from "next/link"
import { DriverAvatar } from "@/components/drivers/driver-avatar"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { ErrorMessage } from "@/components/common/error-message"
import { PageHeader } from "@/components/layout/page-header"
import { RunActualMap } from "@/components/runs/run-actual-map"
import { StatusBadge } from "@/components/common/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { isApiErrorResponse } from "@/lib/api/client"
import { getRun } from "@/lib/api/runs"
import { requireAuth } from "@/lib/auth"
import { formatAddress } from "@/lib/address"
import { AdminLinks, AdminRoute } from "@/lib/routes/admin"
import { LocationDetailsDrawer } from "@/components/locations/location-details-drawer"
import { Badge } from "@/components/ui/badge"
import { ShipmentLocationTimeCell } from "@/components/runs/shipment-location-time-cell"
import { RunStopDuration } from "@/components/runs/run-stop-duration"
import { RunActiveDurationCard } from "@/components/runs/run-active-duration-card"
import { RunAnalysisCard } from "@/components/runs/run-analysis-card"
import { RecordedStopDrawer } from "@/components/runs/recorded-stop-drawer"
import type { Location, ShipmentStop } from "@/lib/types"

function runLocationLabel(location: Location | null | undefined, fallback: string) {
  if (!location) return fallback
  const name = location.name?.trim() || location.company?.trim()
  return [name, formatAddress(location)].filter(Boolean).join(" · ") || fallback
}

function ShipmentLocation({ location, accessToken, merchantId }: { location?: Location | null; accessToken: string; merchantId?: string | null }) {
  if (!location) return <>-</>
  const name = location.name?.trim() || location.company?.trim()
  const address = formatAddress(location)
  return <div className="space-y-1">
    <LocationDetailsDrawer locationId={location.location_id} label={name || address || "Location"} accessToken={accessToken} merchantId={merchantId} />
    <Badge variant="outline">{location.type?.title || "Type not set"}</Badge>
    {address && <div className={name ? "text-muted-foreground" : undefined}>{address}</div>}
    {!name && !address && "-"}
  </div>
}

function dateTime(value?: string | null) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(parsed)
}

function duration(value?: number | null) {
  if (typeof value !== "number") return "-"
  const minutes = Math.round(value / 60)
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`
}

function km(value?: number | null) {
  return typeof value === "number"
    ? `${value.toLocaleString("en-ZA", { maximumFractionDigits: 2 })} km`
    : "-"
}

function speed(value?: number | null) {
  return typeof value === "number"
    ? `${value.toLocaleString("en-ZA", { maximumFractionDigits: 1 })} km/h`
    : "-"
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {note ? <div className="mt-1 text-xs text-muted-foreground">{note}</div> : null}
    </div>
  )
}

function stopName(stop: ShipmentStop) {
  return stop.location?.name || stop.location?.company || stop.shipment?.merchant_order_ref || "Recorded stop"
}

export async function RunDetailContent({ runId, embedded = false }: { runId: string; embedded?: boolean }) {
  const session = await requireAuth()
  const run = await getRun(runId, session.accessToken)

  if (isApiErrorResponse(run)) {
    return <ErrorMessage title="Run" description="Run details and recorded telemetry." message={run.message} />
  }

  const runLabel = String(run.system_run_id ?? "—")
  const initialNow = new Date().toISOString()
  const stats = run.stats
  const safety = run.safety
  const distanceSource = stats?.distance_source === "gps" ? "Calculated from recorded GPS points" : stats?.distance_source === "odometer" ? "Calculated from start and end odometer" : "No distance telemetry"

  return (
    <div className="space-y-6">
      {!embedded && <Breadcrumbs items={[{ label: "Runs", href: AdminLinks.runs }, { label: runLabel }]} />}
      <PageHeader
        title={`Run ${runLabel}`}
        description={`${runLocationLabel(run.origin, "Unknown origin")} → ${runLocationLabel(run.destination, "Unknown destination")}`}
        actions={<div className="flex items-center gap-2"><StatusBadge status={run.status ?? "unknown"} /><AdminRunActions key={run.run_id + session.user.uuid} run={run} token={session.accessToken} /></div>}
      />

      {run.end_request && <RunEndReview key={run.end_request.request_id + run.end_request.status} runId={run.run_id} active={run.status === "in_progress"} request={run.end_request} canReview={run.can_review_end_request === true} accessToken={session.accessToken} unfinished={Math.max(0, (stats?.shipment_count ?? run.shipment_count ?? 0) - (stats?.completed_shipments ?? 0) - (stats?.failed_shipments ?? 0))} />}
      <RunActualMap tripStart={run.started_at} tripEnd={run.completed_at} runId={run.run_id} accessToken={session.accessToken} stops={run.actual_stops ?? []} activities={run.stops} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <RunActiveDurationCard key={run.run_id + (run.started_at ?? "")} status={run.status} startedAt={run.started_at} completedAt={run.completed_at} initialNow={initialNow} />
        <Stat label="Total duration" value={duration(stats?.duration_seconds)} />
        <Stat label="Distance travelled" value={km(stats?.distance_km)} note={distanceSource} />
        <Stat label="Shipments" value={stats?.shipment_count ?? run.shipment_count ?? 0} note={`${stats?.completed_shipments ?? 0} completed · ${stats?.failed_shipments ?? 0} failed`} />
        <Stat label="Actual stops" value={stats?.stop_count ?? 0} />
        <Stat label="Completion" value={stats?.completion_percentage == null ? "-" : `${stats.completion_percentage}%`} />
        <Stat label="Average moving speed" value={speed(stats?.average_moving_speed_kph)} />
        <Stat label="Maximum speed" value={speed(stats?.maximum_speed_kph)} />
        <Stat label="Started" value={dateTime(run.started_at ?? run.planned_start_at)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Driver</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
            <div><div className="text-xs text-muted-foreground">Name</div><div className="font-medium">{run.driver?.driver_id ? <Link className="underline-offset-4 hover:underline" href={AdminRoute.driverDetails(run.driver.driver_id)}><span className="inline-flex items-center gap-2"><DriverAvatar name={run.driver.name} photoUrl={run.driver.profile_photo_url} />{run.driver.name || "Driver"}</span></Link> : "Unassigned"}</div></div>
            <div><div className="text-xs text-muted-foreground">Status</div><div className="font-medium">{run.driver?.is_active == null ? "-" : run.driver.is_active ? "Active" : "Inactive"}</div></div>
            <div><div className="text-xs text-muted-foreground">Email</div><div className="font-medium">{run.driver?.email ?? "-"}</div></div>
            <div><div className="text-xs text-muted-foreground">Telephone</div><div className="font-medium">{run.driver?.telephone ?? "-"}</div></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vehicle</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
            <div><div className="text-xs text-muted-foreground">Vehicle</div><div className="font-medium">{run.vehicle?.vehicle_id ? <Link className="underline-offset-4 hover:underline" href={AdminRoute.vehicleDetails(run.vehicle.vehicle_id)}>{run.vehicle.plate_number || run.vehicle.ref_code || "Vehicle"}</Link> : "Unassigned"}</div></div>
            <div><div className="text-xs text-muted-foreground">Type</div><div className="font-medium">{run.vehicle?.type?.title ?? "-"}</div></div>
            <div><div className="text-xs text-muted-foreground">Make and model</div><div className="font-medium">{[run.vehicle?.make, run.vehicle?.model, run.vehicle?.year].filter(Boolean).join(" ") || "-"}</div></div>
            <div><div className="text-xs text-muted-foreground">Current odometer</div><div className="font-medium">{km(run.vehicle?.odometer)}</div></div>
            <div><div className="text-xs text-muted-foreground">Run odometer</div><div className="font-medium">{km(run.odometer_start_km)} → {km(run.odometer_end_km)}</div></div>
            <div><div className="text-xs text-muted-foreground">Status</div><div className="font-medium">{run.vehicle?.is_active == null ? "-" : run.vehicle.is_active ? "Active" : "Inactive"}</div></div>
          </CardContent>
        </Card>
      </div>

      <RunAnalysisCard key={run.run_id + session.user.uuid} runId={run.run_id} token={session.accessToken} merchantId={run.merchant_id} environmentId={run.environment_id} />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Shipments</CardTitle>
          {run.can_add_shipments && <NewShipmentButton merchantId={run.merchant_id} environmentId={run.environment_id} runId={run.run_id} shipmentIds={(run.shipments ?? []).map(shipment => shipment.shipment_id)} accessToken={session.accessToken} />}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Created at</TableHead><TableHead>Sequence</TableHead><TableHead>Pickup</TableHead><TableHead>Drop-off</TableHead><TableHead>Total time at location</TableHead><TableHead>Parcels</TableHead><TableHead>Shipment status</TableHead><TableHead>Run status</TableHead></TableRow></TableHeader>
            <TableBody>
              {(run.shipments ?? []).length ? (run.shipments ?? []).map((shipment) => (
                <TableRow key={shipment.shipment_id}>
                  <TableCell><Link className="font-medium underline-offset-4 hover:underline" href={AdminRoute.shipmentDetails(shipment.shipment_id)}>{shipment.merchant_order_ref ?? shipment.shipment_id}</Link></TableCell>
                  <TableCell className="whitespace-nowrap">{dateTime(shipment.created_at)}</TableCell>
                  <TableCell>{shipment.sequence ?? "-"}</TableCell>
                  <TableCell><ShipmentLocation location={shipment.pickup_location} accessToken={session.accessToken} merchantId={run.merchant_id} /></TableCell>
                  <TableCell><ShipmentLocation location={shipment.dropoff_location} accessToken={session.accessToken} merchantId={run.merchant_id} /></TableCell>
                  <TableCell><ShipmentLocationTimeCell stops={run.actual_stops ?? []} pickupId={shipment.pickup_location?.location_id} dropoffId={shipment.dropoff_location?.location_id} initialNow={initialNow} startedAt={run.started_at} completedAt={run.completed_at} isActive={run.status === "in_progress"} vehicleId={run.vehicle?.vehicle_id} /></TableCell>
                  <TableCell>{shipment.total_parcel_count ?? "-"}</TableCell>
                  <TableCell><StatusBadge status={shipment.shipment_status ?? "unknown"} /></TableCell>
                  <TableCell><StatusBadge status={shipment.run_status ?? "unknown"} /></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No shipments are attached to this run.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card><CardContent><AdditionalCosts kind="runs" id={run.run_id} accessToken={session.accessToken} merchantId={run.merchant_id} environmentId={run.environment_id} /></CardContent></Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle>Safety and speeding</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Speeding events" value={safety?.speeding_event_count ?? 0} />
              <Stat label="Maximum speed" value={speed(safety?.maximum_speed_kph)} />
              <Stat label="Worst exceedance" value={speed(safety?.worst_speed_exceedance_kph)} />
            </div>
            <div>
              <Table>
                <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Speed</TableHead><TableHead>Limit</TableHead><TableHead>Location</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(safety?.speeding_events ?? []).length ? safety!.speeding_events.map((event) => (
                    <TableRow key={event.activity_id}>
                      <TableCell>{dateTime(event.occurred_at)}</TableCell><TableCell>{speed(event.speed_kph)}</TableCell><TableCell>{speed(event.speed_limit_kph)}</TableCell><TableCell>{event.location?.name ?? (event.latitude != null && event.longitude != null ? `${event.latitude}, ${event.longitude}` : "-")}</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No speeding events were recorded. Other safety event types are not available from the current telemetry.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recorded stops</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(run.actual_stops ?? []).length ? (run.actual_stops ?? []).map((stop, index) => (
              <div key={stop.activity_id ?? index} className="border-l-2 pl-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{index + 1}. {stop.location?.location_id ? <LocationDetailsDrawer locationId={stop.location.location_id} label={stopName(stop)} accessToken={session.accessToken} merchantId={run.merchant_id} /> : <RecordedStopDrawer stop={stop} label={stopName(stop)} accessToken={session.accessToken} merchantId={run.merchant_id} />}</span>
                  <Badge variant="outline">{stop.location?.type?.title || "Type not set"}</Badge>
                </div>
                <div className="capitalize text-xs text-muted-foreground">{(stop.event_type ?? "stop").replaceAll("_", " ")} · {dateTime(stop.occurred_at)}</div>
                <RunStopDuration stop={stop} />
              </div>
            )) : <div className="text-sm text-muted-foreground">No stop events were recorded for this run.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
