"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarDays, ListFilter, ChevronLeft, ChevronRight, GripVertical, Package, Plus, RefreshCw, Truck, UserRound, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer"
import { LocationCombobox } from "@/components/locations/location-combobox"
import { ShipmentQuoteDialog, type ShipmentQuoteFormValues } from "@/components/shipments/shipment-quote-dialog"
import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import { assignScheduledDriver, createScheduledRun, getSchedule, transferScheduledShipment } from "@/lib/api/schedule"
import type { ScheduleData, ScheduleFilters, ScheduleItem, SchedulePage, ScheduleRun, ScheduleShipment, ScheduleTruck } from "@/lib/api/schedule"
import type { Location } from "@/lib/types"
import { AdminRoute } from "@/lib/routes/admin"
import { shipmentCreatePayload } from "@/lib/shipment-create-payload"
import { cn } from "@/lib/utils"
import { dateInTimezone, eligibleRun, merchantTimeToIso, shiftDay } from "./schedule-utils"

type Props = { merchantId: string; environmentId?: string; token: string; timezone: string }
type RunForm = { requestId: string; truck: ScheduleTruck; item?: ScheduleItem; run?: ScheduleRun }
const shipmentStatuses = ["draft", "ready", "quoted", "booked", "offer_failed", "in_transit", "at_delivery_location", "delivered", "exception", "failed", "cancelled", "returned"]
const defaultShipmentStatuses = shipmentStatuses.filter(status => !["delivered", "failed", "cancelled", "returned"].includes(status))
const shipmentStatusLabel = (status: string) => status.replaceAll("_", " ").replace(/^./, value => value.toUpperCase())
const selectClass = "h-9 rounded-md border bg-background px-2 text-sm"
const statusName = (status: string) => status === "in_progress" ? "Active" : status === "dispatched" ? "Ready" : "Planned"

function Pagination({ page, onChange, disabled }: { page?: SchedulePage; onChange: (page: number) => void; disabled: boolean }) {
  if (!page || page.last_page <= 1) return null
  return <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
    <Button variant="ghost" size="sm" aria-label="Previous page" disabled={disabled || page.current_page <= 1} onClick={() => onChange(page.current_page - 1)}><ChevronLeft className="size-4" /></Button>
    {page.current_page} / {page.last_page}
    <Button variant="ghost" size="sm" aria-label="Next page" disabled={disabled || page.current_page >= page.last_page} onClick={() => onChange(page.current_page + 1)}><ChevronRight className="size-4" /></Button>
  </div>
}

export function ScheduleBoard({ merchantId, environmentId: initialEnvironmentId, token, timezone: initialTimezone }: Props) {
  const [environmentId, setEnvironmentId] = React.useState(initialEnvironmentId)
  const [filters, setFilters] = React.useState<ScheduleFilters>(() => {
    const today = dateInTimezone(new Date(), initialTimezone)
    return { from: today, to: today, driver_search: "", truck_search: "", shipment_search: "", shipment_statuses: defaultShipmentStatuses.join(","), driver_filter: "all", fleet_status: "active", availability: "all", truck_page: 1, driver_page: 1, shipment_page: 1 }
  })
  const [data, setData] = React.useState<ScheduleData | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [refresh, setRefresh] = React.useState(0)
  const [tab, setTab] = React.useState("runs")
  const [selected, setSelected] = React.useState<ScheduleItem | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const [hover, setHover] = React.useState<string | null>(null)
  const [picker, setPicker] = React.useState<{ truck?: ScheduleTruck; item: ScheduleItem } | null>(null)
  const [form, setForm] = React.useState<RunForm | null>(null)
  const [origin, setOrigin] = React.useState<Location | null>(null)
  const [destination, setDestination] = React.useState<Location | null>(null)
  const [plannedTime, setPlannedTime] = React.useState("")
  const [formError, setFormError] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const operation = React.useRef(false)
  const request = React.useRef<AbortController | null>(null)
  const timezone = data?.timezone || initialTimezone
  const canManage = data?.can_manage === true

  React.useEffect(() => {
    if (filters.to < filters.from) { setLoading(false); setError("The end date must be on or after the start date."); return }
    const controller = new AbortController()
    request.current = controller
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await getSchedule(merchantId, environmentId, filters, token, controller.signal)
        if (controller.signal.aborted) return
        if (isApiErrorResponse(response)) { setError(response.message); return }
        setData(response.data); setError(null)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load the schedule.")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 200)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [merchantId, environmentId, filters, token, refresh])

  function changeFilters(patch: Partial<ScheduleFilters>) {
    setSelected(null)
    setFilters(previous => ({ ...previous, truck_page: 1, driver_page: 1, shipment_page: 1, ...patch }))
  }
  function refreshBoard() { setRefresh(value => value + 1) }
  async function perform(action: () => Promise<unknown>) {
    if (operation.current) throw new Error("Wait for the current change to finish.")
    operation.current = true; setBusy(true); request.current?.abort()
    try {
      const result = await action()
      if (isApiErrorResponse(result)) throw new Error(result.message)
      setSelected(null); setPicker(null); setHover(null)
      return result
    } finally { operation.current = false; setBusy(false); refreshBoard() }
  }
  async function assign(item: ScheduleItem, run: ScheduleRun) {
    if (!eligibleRun(item, run) || busy) return
    if (item.kind === "driver" && run.driver && run.driver.driver_id !== item.driver.driver_id && !window.confirm(`Replace ${run.driver.name} with ${item.driver.name}?`)) return
    try {
      await perform(() => item.kind === "driver" ? assignScheduledDriver(run.run_id, item.driver.driver_id, run.driver?.driver_id ?? null, token)
        : transferScheduledShipment(merchantId, environmentId, item.shipment, run.run_id, token))
      toast.success(item.kind === "driver" ? "Driver assigned" : "Shipment assigned")
    } catch (err) { toast.error(err instanceof Error ? err.message : "Assignment failed. Refresh and retry.") }
  }
  function openForm(truck: ScheduleTruck, item?: ScheduleItem, run?: ScheduleRun) {
    setPicker(null); setForm({ truck, item, run, requestId: crypto.randomUUID() }); setFormError(null)
    setOrigin(run?.origin ? { ...run.origin } as Location : null)
    setDestination(run?.destination ? { ...run.destination } as Location : null)
    if (run?.planned_start_at) {
      const date = new Date(run.planned_start_at)
      const time = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)
      setPlannedTime(`${dateInTimezone(date, timezone)}T${time}`)
    } else setPlannedTime(`${filters.from}T08:00`)
  }
  function truckTarget(truck: ScheduleTruck, item: ScheduleItem) {
    if (busy) return
    const eligible = truck.runs.filter(run => eligibleRun(item, run))
    if (!eligible.length && truck.can_create) openForm(truck, item)
    else setPicker({ truck, item })
  }
  async function submitRun(event: React.FormEvent) {
    event.preventDefault()
    if (!form || !origin?.location_id || !destination?.location_id) { setFormError("Choose saved start and end locations."); return }
    try {
      const payload = { merchant_id: merchantId, environment_id: environmentId, vehicle_id: form.truck.vehicle_id,
        schedule_managed: true as const, schedule_request_id: form.requestId, origin_location_id: origin.location_id, destination_location_id: destination.location_id,
        planned_start_at: merchantTimeToIso(plannedTime, timezone),
        driver_id: form.item?.kind === "driver" ? form.item.driver.driver_id : undefined,
        shipment_ids: form.item?.kind === "shipment" ? [form.item.shipment.shipment_id] : undefined }
      // Moving an assigned shipment into a new run uses one backend transaction too.
      await perform(() => form.run ? apiFetch(`/api/v1/runs/${form.run.run_id}`, { method: "PATCH", token,
        body: { origin_location_id: payload.origin_location_id, destination_location_id: payload.destination_location_id, planned_start_at: payload.planned_start_at } })
        : form.item?.kind === "shipment" && form.item.shipment.source_run_id
          ? apiFetch("/api/v1/schedule/runs", { method: "POST", token, body: { ...payload, expected_source_run_id: form.item.shipment.source_run_id } })
          : createScheduledRun(payload, token))
      setForm(null); toast.success(form.run ? "Run updated" : "Run planned")
    } catch (err) { setFormError(err instanceof Error ? err.message : "Unable to save this run.") }
  }
  async function returnShipment(shipment: ScheduleShipment) {
    try { await perform(() => transferScheduledShipment(merchantId, environmentId, shipment, null, token)); toast.success("Shipment returned to Unassigned") }
    catch (err) { toast.error(err instanceof Error ? err.message : "Unable to remove shipment.") }
  }
  async function removeDriver(run: ScheduleRun) {
    try { await perform(() => assignScheduledDriver(run.run_id, null, run.driver?.driver_id ?? null, token)); toast.success("Driver removed") }
    catch (err) { toast.error(err instanceof Error ? err.message : "Unable to remove driver.") }
  }
  async function createShipment(values: ShipmentQuoteFormValues, runId?: string) {
    return perform(() => apiFetch(runId ? `/api/v1/runs/${runId}/shipments/create` : "/api/v1/shipments", {
      method: "POST", token, body: shipmentCreatePayload(values, environmentId, false),
    }))
  }
  function shipmentDrawer(runId?: string) {
    return <ShipmentQuoteDialog merchantId={merchantId} environmentId={environmentId ?? ""} token={token} title="Create shipment"
      triggerLabel={runId ? "Add new shipment" : "Create shipment"} description="Capture pickup, destination and parcel details."
      includeOrderRef includeInvoicedAt={false} trigger={<Button size="sm" variant={runId ? "outline" : "default"} disabled={!canManage || busy}><Plus className="size-4" />{runId ? "New shipment" : "Create shipment"}</Button>}
      onSubmit={values => createShipment(values, runId)} />
  }
  function beginDrag(event: React.DragEvent, item: ScheduleItem) {
    event.dataTransfer.setData("application/x-spaces-schedule", "assignment")
    event.dataTransfer.effectAllowed = "move"; setSelected(item); setDragging(true)
  }
  function dragEnd() { setDragging(false); setHover(null) }
  function over(event: React.DragEvent, id: string, eligible: boolean) {
    if (!dragging || !selected || !eligible || busy) return
    event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; setHover(id)
  }
  function shipmentCard(shipment: ScheduleShipment, movable: boolean) {
    movable = movable && !["delivered", "failed", "cancelled", "returned"].includes(shipment.status)
    const item: ScheduleItem = { kind: "shipment", shipment }
    const chosen = selected?.kind === "shipment" && selected.shipment.shipment_id === shipment.shipment_id
    return <div key={shipment.shipment_id} draggable={movable && canManage && !busy} onDragStart={event => beginDrag(event, item)} onDragEnd={dragEnd}
      className={cn("rounded-lg border bg-background p-3 text-sm", movable && canManage && "cursor-grab", chosen && "border-primary bg-primary/5")}>
      <div className="flex items-center gap-2"><Package className="size-4 shrink-0 text-muted-foreground" /><Link className="min-w-0 flex-1 truncate font-medium hover:underline" href={AdminRoute.shipmentDetails(shipment.shipment_id)}>{shipment.reference || shipment.delivery_note_number || "Shipment"}</Link>{movable && canManage && <GripVertical className="size-4 text-muted-foreground" />}</div>
      <p className="mt-1 text-xs text-muted-foreground">{shipmentStatusLabel(shipment.status)}</p>
      <p className="mt-2 text-xs text-muted-foreground">{shipment.pickup?.name || "Pickup not set"} → {shipment.dropoff?.name || "Destination not set"}</p>
      <p className="mt-1 text-xs text-muted-foreground">Collection: {shipment.collection_date ? formatTime(shipment.collection_date) : "Not set"}</p>
      {movable && canManage && <div className="mt-2 flex flex-wrap gap-1"><Button size="sm" variant="ghost" disabled={busy} onClick={() => { setSelected(item); setPicker({ item }) }}>{shipment.source_run_id ? "Move" : "Assign"}</Button>
        {shipment.source_run_id && <Button size="sm" variant="ghost" disabled={busy} onClick={() => returnShipment(shipment)}>Unassign</Button>}</div>}
    </div>
  }
  function formatTime(value: string) { return new Intl.DateTimeFormat("en-ZA", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)) }
  function runCard(run: ScheduleRun, truck: ScheduleTruck) {
    const eligible = !!selected && eligibleRun(selected, run)
    return <article key={run.run_id} onDragOver={event => over(event, run.run_id, eligible)} onDragLeave={() => setHover(null)}
      onDrop={event => { if (!dragging) return; event.preventDefault(); event.stopPropagation(); setDragging(false); if (selected && eligible) void assign(selected, run) }}
      className={cn("rounded-xl border bg-background p-3", run.status === "in_progress" && "border-emerald-300", dragging && eligible && "border-dashed border-primary", hover === run.run_id && "bg-primary/10 ring-2 ring-primary")}>
      <div className="flex flex-wrap items-center justify-between gap-2"><span className={cn("rounded-full px-2 py-1 text-xs font-medium", run.status === "in_progress" ? "bg-emerald-100 text-emerald-800" : run.status === "dispatched" ? "bg-blue-100 text-blue-800" : "bg-muted text-muted-foreground")}>{statusName(run.status)}</span>
        <Link href={AdminRoute.runDetails(run.run_id)} className="text-xs text-muted-foreground hover:underline">View run ↗</Link></div>
      <p className="mt-3 text-sm font-semibold">{run.origin?.name || "Start not set"} <span className="font-normal text-muted-foreground">→</span> {run.destination?.name || "End not set"}</p>
      <p className="mt-1 text-xs text-muted-foreground">{run.planned_start_at ? formatTime(run.planned_start_at) : "No planned time"}</p>
      {run.waiting_reason && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{run.waiting_reason}</p>}
      <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-sm"><span className="flex items-center gap-2"><UserRound className="size-4" />{run.driver?.name || "Driver not assigned"}</span>
        {run.driver && run.can_assign_driver && <Button size="icon" variant="ghost" className="size-7" aria-label={`Remove ${run.driver.name} from run`} disabled={busy} onClick={() => removeDriver(run)}><X className="size-3" /></Button>}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2"><Button size="sm" variant="ghost" onClick={() => setExpanded(old => { const next = new Set(old); if (next.has(run.run_id)) next.delete(run.run_id); else next.add(run.run_id); return next })}>{expanded.has(run.run_id) ? "Hide" : "Show"} {run.shipments.length} shipment{run.shipments.length === 1 ? "" : "s"}</Button>
        {canManage && run.schedule_managed && run.can_assign_driver && <Button variant="ghost" size="sm" disabled={busy} onClick={() => openForm(truck, undefined, run)}>Edit plan</Button>}
        {run.can_add_shipment && shipmentDrawer(run.run_id)}
        {selected && eligible && !dragging && <Button size="sm" disabled={busy} onClick={() => assign(selected, run)}>Assign here</Button>}</div>
      {expanded.has(run.run_id) && <div className="mt-2 grid gap-2">{run.shipments.length ? run.shipments.map(shipment => shipmentCard(shipment, run.status !== "in_progress" && !["delivered", "failed", "cancelled", "returned"].includes(shipment.status))) : <p className="py-2 text-xs text-muted-foreground">No shipments yet. Add a shipment to make this run ready.</p>}</div>}
    </article>
  }
  const truckChoices = picker?.truck ? [picker.truck] : data?.trucks ?? []
  return <div className="@container flex min-h-0 flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><CalendarDays className="size-6" />Schedule</h1><p className="mt-1 text-sm text-muted-foreground">Plan drivers and shipments by truck.</p></div>
      <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={busy || loading} onClick={refreshBoard}><RefreshCw className={cn("size-4", loading && "animate-spin")} />Refresh</Button>{shipmentDrawer()}</div></div>
    <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-background p-3">
      <Button variant="outline" size="icon" aria-label="Previous day" disabled={busy} onClick={() => changeFilters({ from: shiftDay(filters.from, -1), to: shiftDay(filters.to, -1) })}><ChevronLeft className="size-4" /></Button>
      <div className="grid gap-1"><Label htmlFor="schedule-from">From</Label><Input id="schedule-from" type="date" value={filters.from} disabled={busy} onChange={event => { if (event.target.value) changeFilters({ from: event.target.value, to: filters.to < event.target.value ? event.target.value : filters.to }) }} /></div>
      <div className="grid gap-1"><Label htmlFor="schedule-to">To</Label><Input id="schedule-to" type="date" value={filters.to} min={filters.from} disabled={busy} onChange={event => { if (event.target.value) changeFilters({ to: event.target.value }) }} /></div>
      <Button variant="outline" size="icon" aria-label="Next day" disabled={busy} onClick={() => changeFilters({ from: shiftDay(filters.from, 1), to: shiftDay(filters.to, 1) })}><ChevronRight className="size-4" /></Button>
      <Button variant="outline" disabled={busy} onClick={() => { const today = dateInTimezone(new Date(), timezone); changeFilters({ from: today, to: today }) }}>Today</Button><select aria-label="Shipment environment" className={selectClass} value={environmentId ?? ""} disabled={busy || loading} onChange={event => { setEnvironmentId(event.target.value || undefined); setData(null); setSelected(null); setPicker(null); setForm(null); setExpanded(new Set()); changeFilters({}) }}><option value="">General shipments</option>{data?.environments.map(environment => <option key={environment.environment_id} value={environment.environment_id}>{environment.name}</option>)}</select><span className="mb-2 ml-auto text-xs text-muted-foreground">{timezone}</span>
    </div>
    {error && <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><span>{error}{data && " Showing the last loaded schedule."}</span><Button size="sm" variant="outline" disabled={busy} onClick={refreshBoard}>Retry</Button></div>}
    {selected && !dragging && <div role="status" className="flex items-center justify-between rounded-lg border bg-primary/5 p-3 text-sm"><span>Selected {selected.kind === "driver" ? selected.driver.name : selected.shipment.reference}. Choose a truck or run.</span><Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Cancel</Button></div>}
    <div role="tablist" aria-label="Schedule panels" className="flex gap-1 rounded-lg bg-muted p-1 @min-[1100px]:hidden">{["drivers", "runs", "shipments"].map(value => <Button key={value} role="tab" aria-selected={tab === value} className="flex-1 capitalize" variant={tab === value ? "secondary" : "ghost"} onClick={() => setTab(value)}>{value}</Button>)}</div>
    <div aria-busy={loading || busy} className="grid min-h-0 gap-4 @min-[1100px]:grid-cols-[minmax(220px,1fr)_minmax(480px,2.8fr)_minmax(250px,1.15fr)]">
      <section aria-label="Drivers" className={cn("flex h-[calc(100dvh-300px)] min-h-96 flex-col overflow-hidden rounded-xl border bg-background", tab !== "drivers" && "hidden @min-[1100px]:flex")}>
        <div className="grid gap-3 border-b p-4"><h2 className="font-semibold">Drivers <span className="text-xs font-normal text-muted-foreground">{data?.pagination.drivers.total ?? ""}</span></h2>
          <div className="flex rounded-lg bg-muted p-1">{["all", "unassigned", "assigned"].map(value => <button key={value} disabled={busy} onClick={() => changeFilters({ driver_filter: value })} className={cn("flex-1 rounded-md px-1 py-2 text-xs capitalize", filters.driver_filter === value && "bg-background shadow-sm")}>{value}</button>)}</div>
          <Input aria-label="Search drivers" placeholder="Search drivers…" value={filters.driver_search} disabled={busy} onChange={event => changeFilters({ driver_search: event.target.value })} /></div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">{loading && !data ? <p className="text-sm text-muted-foreground">Loading drivers…</p> : data?.drivers.map(driver => <div key={driver.driver_id} draggable={canManage && !busy} onDragStart={event => beginDrag(event, { kind: "driver", driver })} onDragEnd={dragEnd} className="flex items-center gap-2 rounded-lg border p-3">
          <span className="shrink-0 rounded-full bg-muted p-1.5"><UserRound className="size-4 text-muted-foreground" /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{driver.name}</p><p className="whitespace-nowrap text-xs text-muted-foreground">{driver.phone || (driver.assigned ? "Assigned to a run" : "Unassigned")}</p></div>
          {canManage && <Button size="icon" className="size-7 shrink-0" variant="ghost" aria-label={`Assign ${driver.name}`} title={`Assign ${driver.name}`} disabled={busy} onClick={() => { const item: ScheduleItem = { kind: "driver", driver }; setSelected(item); setPicker({ item }) }}><Plus className="size-4" /></Button>}</div>)}{!loading && data?.drivers.length === 0 && <p className="p-3 text-sm text-muted-foreground">No matching drivers.</p>}</div>
        <Pagination page={data?.pagination.drivers} disabled={loading || busy} onChange={driver_page => setFilters(old => ({ ...old, driver_page }))} />
      </section>
      <section aria-label="Truck runs" className={cn("flex h-[calc(100dvh-300px)] min-h-96 flex-col overflow-hidden rounded-xl border bg-background", tab !== "runs" && "hidden @min-[1100px]:flex")}>
        <div className="flex flex-wrap gap-2 border-b p-3"><Input aria-label="Search trucks" className="min-w-32 flex-1" placeholder="Search truck…" value={filters.truck_search} disabled={busy} onChange={event => changeFilters({ truck_search: event.target.value })} />
          <select aria-label="Fleet availability" className={selectClass} value={filters.availability} disabled={busy} onChange={event => changeFilters({ availability: event.target.value })}><option value="all">Availability: All</option><option value="available">Available</option><option value="busy">Ready / Active</option></select>
          <select aria-label="Fleet status" className={selectClass} value={filters.fleet_status} disabled={busy} onChange={event => changeFilters({ fleet_status: event.target.value })}><option value="active">Fleet: Active</option><option value="inactive">Fleet: Inactive</option><option value="all">Fleet: All</option></select></div>
        <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-3">{loading && !data ? <p className="text-sm text-muted-foreground">Loading runs…</p> : data?.trucks.map(truck => <div key={truck.vehicle_id} onDragOver={event => over(event, truck.vehicle_id, truck.can_create || truck.runs.some(run => !!selected && eligibleRun(selected, run)))} onDragLeave={() => setHover(null)}
          onDrop={event => { if (!dragging) return; event.preventDefault(); setDragging(false); setHover(null); if (selected) truckTarget(truck, selected) }} className={cn("rounded-xl border bg-muted/30 p-3", hover === truck.vehicle_id && "ring-2 ring-primary")}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Truck className="size-5 text-muted-foreground" /><h3 className="font-semibold">{truck.plate_number}</h3><span className="text-xs text-muted-foreground">{truck.available ? "Available" : "Unavailable"}</span></div>
            {truck.can_create && <Button variant="outline" size="sm" disabled={busy} onClick={() => selected ? truckTarget(truck, selected) : openForm(truck)}><Plus className="size-4" />{selected ? "Choose run" : "New run"}</Button>}</div>
          <div className="grid gap-3">{truck.runs.filter(run => run.status === "in_progress").map(run => runCard(run, truck))}
            {truck.runs.some(run => run.overdue) && <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Overdue plans</p>}{truck.runs.filter(run => run.overdue).map(run => runCard(run, truck))}
            {truck.runs.filter(run => run.status !== "in_progress" && !run.overdue).map(run => runCard(run, truck))}
            {!truck.runs.length && <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">No runs planned. {truck.can_create && "Drop a driver or shipment here to create a run."}</div>}</div>
        </div>)}{!loading && data?.trucks.length === 0 && <p className="p-4 text-sm text-muted-foreground">No matching trucks.</p>}</div>
        <Pagination page={data?.pagination.trucks} disabled={loading || busy} onChange={truck_page => setFilters(old => ({ ...old, truck_page }))} />
      </section>
      <section aria-label="Unassigned shipments" onDragOver={event => over(event, "unassigned", selected?.kind === "shipment" && !!selected.shipment.source_run_id)} onDrop={event => { if (!dragging) return; event.preventDefault(); setDragging(false); if (selected?.kind === "shipment" && selected.shipment.source_run_id) void returnShipment(selected.shipment) }}
        className={cn("flex h-[calc(100dvh-300px)] min-h-96 flex-col overflow-hidden rounded-xl border bg-background", tab !== "shipments" && "hidden @min-[1100px]:flex", hover === "unassigned" && "ring-2 ring-primary")}>
        <div className="grid gap-3 border-b p-4"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Unassigned shipments <span className="text-xs font-normal text-muted-foreground">{data?.pagination.shipments.total ?? ""}</span></h2>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Filter shipment statuses" disabled={busy} className="relative shrink-0"><ListFilter className="size-4" />{filters.shipment_statuses !== "all" && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary" />}</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end"><DropdownMenuLabel>Shipment status</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={filters.shipment_statuses === "all"} onSelect={event => event.preventDefault()} onCheckedChange={checked => changeFilters({ shipment_statuses: checked ? "all" : "none" })}>All</DropdownMenuCheckboxItem><DropdownMenuSeparator />
              {shipmentStatuses.map(status => <DropdownMenuCheckboxItem key={status} checked={filters.shipment_statuses === "all" || (filters.shipment_statuses ?? "").split(",").includes(status)} onSelect={event => event.preventDefault()} onCheckedChange={checked => {
                const selectedStatuses = filters.shipment_statuses === "all" ? shipmentStatuses : filters.shipment_statuses === "none" ? [] : (filters.shipment_statuses ?? "").split(",")
                const next = checked ? [...selectedStatuses, status] : selectedStatuses.filter(value => value !== status)
                changeFilters({ shipment_statuses: next.length === shipmentStatuses.length ? "all" : next.join(",") || "none" })
              }}>{shipmentStatusLabel(status)}</DropdownMenuCheckboxItem>)}
            </DropdownMenuContent></DropdownMenu>
          </div><Input aria-label="Search unassigned shipments" placeholder="Search shipment…" value={filters.shipment_search} disabled={busy} onChange={event => changeFilters({ shipment_search: event.target.value })} /></div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">{loading && !data ? <p className="text-sm text-muted-foreground">Loading shipments…</p> : data?.shipments.map(shipment => shipmentCard(shipment, true))}{!loading && data?.shipments.length === 0 && <p className="p-3 text-sm text-muted-foreground">No unassigned shipments.</p>}</div>
        <Pagination page={data?.pagination.shipments} disabled={loading || busy} onChange={shipment_page => setFilters(old => ({ ...old, shipment_page }))} />
      </section>
    </div>
    <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{busy ? "Saving assignment…" : loading ? "Refreshing schedule…" : "Active runs stay visible. Today’s plans become ready in scheduled order."}</p>
    <Drawer open={!!picker} onOpenChange={open => { if (!open && !busy) setPicker(null) }}><DrawerContent side="right" className="sm:w-[480px]"><DrawerHeader><DrawerTitle>Choose a run</DrawerTitle><DrawerDescription>Assign {picker?.item.kind === "driver" ? picker.item.driver.name : picker?.item.shipment.reference} to a run, or create a new plan.</DrawerDescription></DrawerHeader>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">{truckChoices.map(truck => <div key={truck.vehicle_id} className="rounded-lg border p-3"><h3 className="mb-2 font-medium">{truck.plate_number}</h3><div className="grid gap-2">{truck.runs.filter(run => picker && eligibleRun(picker.item, run)).map(run => <Button key={run.run_id} className="h-auto justify-start whitespace-normal py-3 text-left" variant="outline" disabled={busy} onClick={() => picker && assign(picker.item, run)}>{statusName(run.status)} · {run.origin?.name || "Start not set"} → {run.destination?.name || "End not set"}</Button>)}
        {truck.can_create && <Button variant="secondary" disabled={busy} onClick={() => picker && openForm(truck, picker.item)}><Plus className="size-4" />Create run</Button>}</div></div>)}{!truckChoices.length && <p className="text-sm text-muted-foreground">No trucks match your filters.</p>}</div>
      {!picker?.truck && <Pagination page={data?.pagination.trucks} disabled={loading || busy} onChange={truck_page => setFilters(old => ({ ...old, truck_page }))} />}
    </DrawerContent></Drawer>
    <Drawer open={!!form} onOpenChange={open => { if (!open && !busy) setForm(null) }}><DrawerContent side="right" className="sm:w-[480px]" showCloseButton={!busy}><DrawerHeader><DrawerTitle>{form?.run ? "Edit planned run" : "Create run"}</DrawerTitle><DrawerDescription>{form?.truck.plate_number} · {timezone}</DrawerDescription></DrawerHeader>
      <form onSubmit={submitRun} className="flex min-h-0 flex-1 flex-col"><div className="flex-1 space-y-5 overflow-y-auto p-4">
        {form?.item && <p className="rounded-lg bg-muted p-3 text-sm">{form.item.kind === "driver" ? `Driver: ${form.item.driver.name}` : `Shipment: ${form.item.shipment.reference}`}</p>}
        <div className="grid gap-2"><Label>Start location</Label><LocationCombobox merchantId={merchantId} environmentId={environmentId ?? null} token={token} value={origin} onChange={location => { setOrigin(location); setForm(old => old && { ...old, requestId: crypto.randomUUID() }) }} disabled={busy} /></div>
        <div className="grid gap-2"><Label>End location</Label><LocationCombobox merchantId={merchantId} environmentId={environmentId ?? null} token={token} value={destination} onChange={location => { setDestination(location); setForm(old => old && { ...old, requestId: crypto.randomUUID() }) }} disabled={busy} /></div>
        <div className="grid gap-2"><Label htmlFor="planned-start">Planned start ({timezone})</Label><Input id="planned-start" required type="datetime-local" value={plannedTime} onChange={event => { setPlannedTime(event.target.value); setForm(old => old && { ...old, requestId: crypto.randomUUID() }) }} disabled={busy} /></div>
        <p className="text-sm text-muted-foreground">Runs become ready on their planned day when a driver, available truck and shipment are assigned. Earlier runs must close first.</p>
        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
      </div><DrawerFooter><Button type="submit" disabled={busy}>{busy ? "Saving…" : form?.run ? "Save plan" : "Create run"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setForm(null)}>Cancel</Button></DrawerFooter></form>
    </DrawerContent></Drawer>
  </div>
}
