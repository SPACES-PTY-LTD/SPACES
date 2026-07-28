import Link from "next/link"
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
import type { ShipmentStop } from "@/lib/types"

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

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  const session = await requireAuth()
  const run = await getRun(runId, session.accessToken)

  if (isApiErrorResponse(run)) {
    return <ErrorMessage title="Run" description="Run details and recorded telemetry." message={run.message} />
  }

  const stats = run.stats
  const safety = run.safety
  const distanceSource = stats?.distance_source === "gps" ? "Calculated from recorded GPS points" : stats?.distance_source === "odometer" ? "Calculated from start and end odometer" : "No distance telemetry"

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Runs", href: AdminLinks.runs }, { label: run.run_id }]} />
      <PageHeader
        title={`Run ${run.run_id}`}
        description={`${run.origin ? formatAddress(run.origin) : "Unknown origin"} → ${run.destination ? formatAddress(run.destination) : "Unknown destination"}`}
        actions={<StatusBadge status={run.status ?? "unknown"} />}
      />

      <RunActualMap trackPoints={run.track_points ?? []} stops={run.actual_stops ?? []} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <div><div className="text-xs text-muted-foreground">Name</div><div className="font-medium">{run.driver?.driver_id ? <Link className="underline-offset-4 hover:underline" href={AdminRoute.driverDetails(run.driver.driver_id)}>{run.driver.name || "Driver"}</Link> : "Unassigned"}</div></div>
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

      <Card>
        <CardHeader><CardTitle>Shipments</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Sequence</TableHead><TableHead>Pickup</TableHead><TableHead>Drop-off</TableHead><TableHead>Parcels</TableHead><TableHead>Shipment status</TableHead><TableHead>Run status</TableHead></TableRow></TableHeader>
            <TableBody>
              {(run.shipments ?? []).length ? (run.shipments ?? []).map((shipment) => (
                <TableRow key={shipment.shipment_id}>
                  <TableCell><Link className="font-medium underline-offset-4 hover:underline" href={AdminRoute.shipmentDetails(shipment.shipment_id)}>{shipment.merchant_order_ref ?? shipment.shipment_id}</Link></TableCell>
                  <TableCell>{shipment.sequence ?? "-"}</TableCell>
                  <TableCell>{shipment.pickup_location ? formatAddress(shipment.pickup_location) : "-"}</TableCell>
                  <TableCell>{shipment.dropoff_location ? formatAddress(shipment.dropoff_location) : "-"}</TableCell>
                  <TableCell>{shipment.total_parcel_count ?? "-"}</TableCell>
                  <TableCell><StatusBadge status={shipment.shipment_status ?? "unknown"} /></TableCell>
                  <TableCell><StatusBadge status={shipment.run_status ?? "unknown"} /></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No shipments are attached to this run.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                <div className="font-medium">{index + 1}. {stopName(stop)}</div>
                <div className="capitalize text-xs text-muted-foreground">{(stop.event_type ?? "stop").replaceAll("_", " ")} · {dateTime(stop.occurred_at)}</div>
              </div>
            )) : <div className="text-sm text-muted-foreground">No stop events were recorded for this run.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
