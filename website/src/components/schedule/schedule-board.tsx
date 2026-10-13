"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { DateRangePicker } from "@/components/common/date-range-picker"
import { ListFilter, ChevronDown, ChevronLeft, ChevronRight, Ellipsis, GripVertical, Package, Plus, RefreshCw, Search, Truck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ScheduleColumnSkeleton } from "./schedule-loading-skeletons"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer"
import { DriverAvatar } from "@/components/drivers/driver-avatar"
import { LocationDetailsDrawer } from "@/components/locations/location-details-drawer"
import { ShipmentMapDialog } from "@/components/dashboard/shipment-map-dialog"
import { DriverDialogContent } from "@/components/dashboard/driver-dialog-content"
import { LocationCombobox } from "@/components/locations/location-combobox"
import { ShipmentQuoteDialog, type ShipmentQuoteFormValues } from "@/components/shipments/shipment-quote-dialog"
import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import { assignScheduledDriver, createScheduledRun, getSchedule, transferScheduledShipment } from "@/lib/api/schedule"
import type { ScheduleData, ScheduleDriver, ScheduleFilters, ScheduleItem, ScheduleLocation, SchedulePage, ScheduleRun, ScheduleShipment, ScheduleTruck } from "@/lib/api/schedule"
import type { Location } from "@/lib/types"
import { shipmentCreatePayload } from "@/lib/shipment-create-payload"
import { cn } from "@/lib/utils"
import { dateInTimezone, eligibleRun, merchantTimeToIso, shiftDay } from "./schedule-utils"

type Props = { merchantId: string; token: string; timezone: string }
type RunForm = { requestId: string; truck: ScheduleTruck; item?: ScheduleItem; run?: ScheduleRun }
type SearchColumn = "drivers" | "runs" | "shipments"
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

export function ScheduleBoard({ merchantId, token, timezone: initialTimezone }: Props) {
  const [filters, setFilters] = React.useState<ScheduleFilters>(() => {
    const today = dateInTimezone(new Date(), initialTimezone)
    return { from: today, to: today, driver_search: "", truck_search: "", shipment_search: "", shipment_statuses: defaultShipmentStatuses.join(","), driver_filter: "all", fleet_status: "active", availability: "all", driver_page: 1, shipment_page: 1 }
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
  const [searchOpen, setSearchOpen] = React.useState<Record<SearchColumn, boolean>>({ drivers: false, runs: false, shipments: false })
  const [detail, setDetail] = React.useState<{ kind: "driver" | "shipment" | "run"; id: string } | null>(null)
  const [driverTarget, setDriverTarget] = React.useState<ScheduleRun | null>(null)
  const searchButtons = React.useRef<Partial<Record<SearchColumn, HTMLButtonElement | null>>>({})
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
        const response = await getSchedule(merchantId, undefined, filters, token, controller.signal)
        if (controller.signal.aborted) return
        if (isApiErrorResponse(response)) { setError(response.message); return }
        setData(response.data); setError(null)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load the schedule.")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 200)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [merchantId, filters, token, refresh])

  function changeFilters(patch: Partial<ScheduleFilters>) {
    setSelected(null)
    setFilters(previous => ({ ...previous, driver_page: 1, shipment_page: 1, ...patch }))
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
    if (!eligibleRun(item, run) || busy) return false
    if (item.kind === "driver" && run.driver && run.driver.driver_id !== item.driver.driver_id && !window.confirm(`Replace ${run.driver.name} with ${item.driver.name}?`)) return false
    try {
      await perform(() => item.kind === "driver" ? assignScheduledDriver(run.run_id, item.driver.driver_id, run.driver?.driver_id ?? null, token)
        : transferScheduledShipment(merchantId, undefined, item.shipment, run.run_id, token))
      toast.success(item.kind === "driver" ? "Driver assigned" : "Shipment assigned")
      return true
    } catch (err) { toast.error(err instanceof Error ? err.message : "Assignment failed. Refresh and retry."); return false }
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
      const payload = { merchant_id: merchantId, vehicle_id: form.truck.vehicle_id,
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
    try { await perform(() => transferScheduledShipment(merchantId, undefined, shipment, null, token)); toast.success("Shipment returned to Unassigned") }
    catch (err) { toast.error(err instanceof Error ? err.message : "Unable to remove shipment.") }
  }
  async function removeDriver(run: ScheduleRun) {
    try { await perform(() => assignScheduledDriver(run.run_id, null, run.driver?.driver_id ?? null, token)); toast.success("Driver removed") }
    catch (err) { toast.error(err instanceof Error ? err.message : "Unable to remove driver.") }
  }
  async function createShipment(values: ShipmentQuoteFormValues, runId?: string) {
    return perform(() => apiFetch(runId ? `/api/v1/runs/${runId}/shipments/create` : "/api/v1/shipments", {
      method: "POST", token, body: shipmentCreatePayload(values, undefined, false),
    }))
  }
  function shipmentDrawer(runId?: string) {
    return <ShipmentQuoteDialog merchantId={merchantId} environmentId="" token={token} title="Create shipment"
      triggerLabel={runId ? "Add new shipment" : "Create shipment"} description="Capture pickup, destination and parcel details."
      includeOrderRef includeInvoicedAt={false} trigger={runId
        ? <Button variant="outline" className="size-11 shrink-0 border-dashed p-0 shadow-none" aria-label={`Add shipment to run ${runId}`} disabled={!canManage || busy}><Plus className="size-5 text-muted-foreground" /></Button>
        : <Button size="sm" disabled={!canManage || busy}>Create shipment</Button>}
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
  function locationName(location: ScheduleLocation | null, fallback: string) {
    return location?.location_id ? <LocationDetailsDrawer key={location.location_id} locationId={location.location_id} label={location.name} accessToken={token} merchantId={merchantId} /> : location?.name || fallback
  }
  function driverName(driver: Pick<ScheduleDriver, "driver_id" | "name" | "profile_photo_url"> | null) {
    return driver ? <button type="button" className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" aria-label={`View driver details for ${driver.name}`} onClick={() => setDetail({ kind: "driver", id: driver.driver_id })}><DriverAvatar name={driver.name} photoUrl={driver.profile_photo_url} size="sm" /><span className="min-w-0 break-words">{driver.name}</span></button> : "Driver not assigned"
  }
  function closeDetails(open: boolean) { if (!open) { setDetail(null); refreshBoard() } }
  function shipmentCard(shipment: ScheduleShipment, movable: boolean) {
    movable = movable && !["delivered", "failed", "cancelled", "returned"].includes(shipment.status)
    const item: ScheduleItem = { kind: "shipment", shipment }
    const chosen = selected?.kind === "shipment" && selected.shipment.shipment_id === shipment.shipment_id
    return <div key={shipment.shipment_id} draggable={movable && canManage && !busy} onDragStart={event => beginDrag(event, item)} onDragEnd={dragEnd}
      className={cn("rounded-lg border bg-background p-3 text-sm", movable && canManage && "cursor-grab", chosen && "border-primary bg-primary/5")}>
      <div className="flex items-center gap-2"><Package className="size-4 shrink-0 text-muted-foreground" /><button type="button" className="min-w-0 flex-1 truncate text-left font-medium hover:underline" aria-label={`View shipment details for ${shipment.reference || shipment.shipment_id}`} onClick={() => setDetail({ kind: "shipment", id: shipment.shipment_id })}>{shipment.reference || shipment.delivery_note_number || "Shipment"}</button>{movable && canManage && <GripVertical className="size-4 text-muted-foreground" />}</div>
      <p className="mt-1 text-xs text-muted-foreground">{shipmentStatusLabel(shipment.status)}</p>
      <p className="mt-2 text-xs">{locationName(shipment.pickup, "Pickup not set")}</p>
      <p className="mt-1 text-xs text-muted-foreground">To {locationName(shipment.dropoff, "Destination not set")}</p>
      <p className="mt-1 text-xs text-muted-foreground">Collection: {shipment.collection_date ? formatTime(shipment.collection_date) : "Not set"}</p>
      {movable && canManage && <div className="mt-2 flex flex-wrap gap-1"><Button size="sm" variant="outline" className="shadow-none" disabled={busy} onClick={() => { setSelected(item); setPicker({ item }) }}>{shipment.source_run_id ? "Move" : "Assign to run"}</Button>
        {shipment.source_run_id && <Button size="sm" variant="ghost" disabled={busy} onClick={() => returnShipment(shipment)}>Unassign</Button>}</div>}
    </div>
  }
  function formatTime(value: string) { return new Intl.DateTimeFormat("en-ZA", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)) }
  function driverAssignment(driver: ScheduleDriver) {
    // Older APIs cannot supply assignments outside the current truck page.
    if (!driver.assigned_runs) return driver.assigned ? "Assigned to a run" : "No assigned runs"
    return driver.assigned_runs.length ? driver.assigned_runs.map(run => `Run ${run.run_id.slice(0, 8)} · ${statusName(run.status)}`).join(" · ") : "No assigned runs"
  }
  function chooseDriver(driver: ScheduleDriver) {
    if (!canManage || busy) return
    const item: ScheduleItem = { kind: "driver", driver }
    setSelected(item)
    if (driverTarget) {
      void assign(item, driverTarget).then(saved => { if (saved) setDriverTarget(null) })
    } else setPicker({ item })
  }
  function searchButton(column: SearchColumn, value: string) {
    const label = column === "runs" ? "trucks" : column
    return <Button ref={node => { searchButtons.current[column] = node }} variant="outline" size="icon"
      className="relative size-9 shadow-none" aria-label={`Toggle search ${label}`} aria-expanded={searchOpen[column]}
      aria-controls={`schedule-search-${column}`} disabled={busy} onClick={() => setSearchOpen(old => ({ ...old, [column]: !old[column] }))}>
      <Search className="size-4" />{value && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />}
    </Button>
  }
  function searchInput(column: SearchColumn, field: "driver_search" | "truck_search" | "shipment_search") {
    if (!searchOpen[column]) return null
    const label = column === "runs" ? "trucks" : column === "shipments" ? "unassigned shipments" : "drivers"
    return <Input id={`schedule-search-${column}`} autoFocus aria-label={`Search ${label}`} placeholder={`Search ${label}…`}
      className="mt-3" value={filters[field]} disabled={busy} onChange={event => changeFilters({ [field]: event.target.value })}
      onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setSearchOpen(old => ({ ...old, [column]: false })); searchButtons.current[column]?.focus() } }} />
  }
  function shipmentTile(shipment: ScheduleShipment, run: ScheduleRun) {
    const movable = canManage && run.can_assign_driver && !["delivered", "failed", "cancelled", "returned"].includes(shipment.status)
    const item: ScheduleItem = { kind: "shipment", shipment }
    const chosen = selected?.kind === "shipment" && selected.shipment.shipment_id === shipment.shipment_id
    return <div key={shipment.shipment_id} data-schedule-shipment-tile draggable={movable && !busy}
      onDragStart={event => beginDrag(event, item)} onDragEnd={dragEnd}
      className={cn("relative min-h-11 w-[200px] shrink-0 rounded-md bg-muted px-2 py-1", movable && "cursor-grab pr-6", chosen && "ring-1 ring-primary")}>
      <button type="button" aria-label={`View shipment details for ${shipment.reference || shipment.shipment_id}`} onClick={() => setDetail({ kind: "shipment", id: shipment.shipment_id })} className="block w-full rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5"><span className="flex min-w-0 items-start gap-1 text-[11px] font-medium"><Package className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /><span className="break-words">{shipment.reference || shipment.delivery_note_number || "Shipment"}</span></span>
          <span className={cn("text-[10px] text-muted-foreground", shipment.status === "in_transit" && "text-emerald-700 dark:text-emerald-400")}>{shipmentStatusLabel(shipment.status)}</span></div>
      </button>
      <div className="mt-0.5 break-words text-xs text-muted-foreground">{locationName(shipment.dropoff, "Destination not set")}</div>
      {movable && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-xs" className="absolute right-0 top-0" aria-label={`Shipment options for ${shipment.reference || shipment.shipment_id}`} disabled={busy}><Ellipsis className="size-3" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { setSelected(item); setPicker({ item }) }}>Move shipment</DropdownMenuItem><DropdownMenuItem onSelect={() => void returnShipment(shipment)}>Return to unassigned</DropdownMenuItem></DropdownMenuContent>
      </DropdownMenu>}
    </div>
  }
  function runCard(run: ScheduleRun, truck: ScheduleTruck) {
    const eligible = !!selected && eligibleRun(selected, run)
    const active = run.status === "in_progress"
    return <article key={run.run_id} data-schedule-run aria-label={`Run ${run.run_id}`} onDragOver={event => over(event, run.run_id, eligible)} onDragLeave={() => setHover(null)}
      onDrop={event => { if (!dragging) return; event.preventDefault(); event.stopPropagation(); setDragging(false); if (selected && eligible) void assign(selected, run) }}
      className={cn("min-w-0 space-y-1.5 rounded-lg border bg-background p-2", active && "border-emerald-500", run.overdue && "bg-amber-50/60 dark:bg-amber-950/20", dragging && eligible && "border-dashed border-primary", hover === run.run_id && "bg-primary/10 ring-2 ring-primary")}>
      <div className="flex items-start justify-between gap-2"><div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className={cn("rounded-md px-2 py-1 text-[11px]", active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : run.status === "dispatched" ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : run.overdue ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-muted text-muted-foreground")}>{run.overdue ? "Overdue" : statusName(run.status)}</span>
        <span className="break-words text-[11px] text-muted-foreground">{run.planned_start_at ? formatTime(run.planned_start_at) : "No planned time"} · {run.run_id.slice(0, 8)}</span></div>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="h-7 gap-1.5 px-2 text-[11px] font-normal shadow-none" aria-label={`Options for run ${run.run_id}`} disabled={busy}>Options<ChevronDown className="size-3" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setDetail({ kind: "run", id: run.run_id })}>View run</DropdownMenuItem>
            {canManage && run.schedule_managed && run.can_assign_driver && <DropdownMenuItem onSelect={() => openForm(truck, undefined, run)}>Edit plan</DropdownMenuItem>}
            {canManage && run.can_assign_driver && <DropdownMenuItem onSelect={() => { setPicker(null); setDriverTarget(run); setSelected(null) }}>{run.driver ? "Replace driver" : "Assign driver"}</DropdownMenuItem>}
            {canManage && run.driver && run.can_assign_driver && <DropdownMenuItem onSelect={() => void removeDriver(run)}>Remove driver</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-col items-start justify-between gap-x-4 gap-y-1 sm:flex-row sm:flex-wrap"><p className="min-w-0 flex-1 break-words text-xs font-medium">{locationName(run.origin, "Start not set")} <span className="font-normal text-muted-foreground">→</span> {locationName(run.destination, "End not set")}</p>
        <p className="max-w-full break-words text-[11px] text-muted-foreground sm:text-right">{driverName(run.driver)} · {run.shipments.length} shipment{run.shipments.length === 1 ? "" : "s"}</p></div>
      {run.waiting_reason && <p className="break-words text-[11px] text-amber-700 dark:text-amber-400">{run.waiting_reason}</p>}
      {active && <p className="text-[11px] text-muted-foreground">Driver &amp; existing shipments locked</p>}
      <div aria-label={`Shipments for run ${run.run_id}`} className="flex min-w-0 items-start gap-2 overflow-x-auto pb-1">
        {run.shipments.map(shipment => shipmentTile(shipment, run))}
        {!run.shipments.length && <p className="self-center text-xs text-muted-foreground">No shipments yet</p>}
        {canManage && run.can_add_shipment && shipmentDrawer(run.run_id)}
      </div>
      {selected && eligible && !dragging && <Button size="sm" disabled={busy} onClick={() => assign(selected, run)}>Assign here</Button>}
    </article>
  }
  const truckChoices = picker?.truck ? [picker.truck] : data?.trucks ?? []
  const summary = data?.summary
  return <div className="@container flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 bg-muted/20 px-4 py-3"><div><h1 className="text-[28px] font-semibold leading-tight">Runs Schedule</h1><p className="mt-1 text-sm text-muted-foreground">Assign drivers and shipments with a clear view of each truck’s run queue.</p></div>
      <div className="flex items-center gap-2"><Button variant="outline" className="shadow-none" disabled={busy || loading} onClick={refreshBoard}><RefreshCw className={cn("size-4", loading && "animate-spin")} />Refresh</Button>{shipmentDrawer()}</div></div>
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-y px-3 py-3">
      <Button variant="outline" size="icon" aria-label="Previous day" disabled={busy} onClick={() => changeFilters({ from: shiftDay(filters.from, -1), to: shiftDay(filters.to, -1) })}><ChevronLeft className="size-4" /></Button>
      <DateRangePicker
        aria-label="Filter runs by creation date range"
        value={{ from: parseISO(filters.from), to: parseISO(filters.to) }}
        disabled={busy}
        allowClear={false}
        className="max-w-full"
        onChange={range => {
          if (!range?.from) return
          changeFilters({ from: format(range.from, "yyyy-MM-dd"), to: format(range.to ?? range.from, "yyyy-MM-dd") })
        }}
      />
      <Button variant="outline" size="icon" aria-label="Next day" disabled={busy} onClick={() => changeFilters({ from: shiftDay(filters.from, 1), to: shiftDay(filters.to, 1) })}><ChevronRight className="size-4" /></Button>
      <Button variant="ghost" disabled={busy} onClick={() => { const today = dateInTimezone(new Date(), timezone); changeFilters({ from: today, to: today }) }}>Today</Button>
      <span className="ml-auto text-xs text-muted-foreground">{timezone}</span>
    </div>
    <dl aria-label="Schedule summary" className="grid shrink-0 grid-cols-3 gap-x-3 gap-y-2 border-b px-3 py-3 text-xs @min-[700px]:grid-cols-5">
      {([['Drivers unassigned', summary?.unassigned_drivers], ['Trucks available', summary?.available_trucks], ['Active runs', summary?.active_runs], ['Overdue plans', summary?.overdue_plans], ['Unassigned shipments', summary?.unassigned_shipments]] as const).map(([label, count]) => <div key={label}><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 font-medium tabular-nums">{loading && !data ? <Skeleton aria-hidden="true" className="h-4 w-8 motion-reduce:animate-none" /> : count ?? "—"}</dd></div>)}
    </dl>
    {error && <div role="alert" className="flex shrink-0 items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/5 p-3 text-sm"><span>{error}{data && " Showing the last loaded schedule."}</span><Button size="sm" variant="outline" disabled={busy} onClick={refreshBoard}>Retry</Button></div>}
    {selected && !dragging && <div role="status" className="flex shrink-0 items-center justify-between gap-2 border-b bg-primary/5 px-3 py-2 text-sm"><span>Choose a run for {selected.kind === "driver" ? selected.driver.name : selected.shipment.reference}.</span><Button variant="ghost" size="sm" onClick={() => { setSelected(null); setPicker(null) }}>Cancel</Button></div>}
    <div role="tablist" aria-label="Schedule sections" className="flex shrink-0 gap-1 border-b p-2 @min-[1100px]:hidden">{["drivers", "runs", "shipments"].map(value => <Button key={value} role="tab" aria-selected={tab === value} aria-controls={`schedule-panel-${value}`} variant={tab === value ? "default" : "ghost"} className="flex-1 capitalize" onClick={() => setTab(value)}>{value}</Button>)}</div>
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 @min-[1100px]:grid-cols-[248px_minmax(0,1fr)_288px]">
      <section id="schedule-panel-drivers" aria-label="Drivers" className={cn("flex min-h-0 min-w-0 flex-col bg-background", tab !== "drivers" && "hidden @min-[1100px]:flex")}>
        <div className="shrink-0 p-4"><div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">Drivers <span className="ml-1 text-xs font-normal text-muted-foreground">{data?.pagination.drivers.total ?? ""}</span></h2><div className="flex items-center gap-2">
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="relative size-9 shadow-none" aria-label="Filter driver assignments" disabled={busy}><ListFilter className="size-4" />{filters.driver_filter !== "all" && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Driver assignment</DropdownMenuLabel><DropdownMenuRadioGroup value={filters.driver_filter} onValueChange={driver_filter => changeFilters({ driver_filter })}>{["all", "unassigned", "assigned"].map(value => <DropdownMenuRadioItem key={value} value={value} className="capitalize">{value}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
          {searchButton("drivers", filters.driver_search)}</div></div>{searchInput("drivers", "driver_search")}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4">{loading && !data ? <ScheduleColumnSkeleton column="drivers" /> : data?.drivers.map(driver => <div key={driver.driver_id} data-schedule-driver-row draggable={canManage && !busy}
          onDragStart={event => beginDrag(event, { kind: "driver", driver })} onDragEnd={dragEnd}
          className={cn("flex min-h-16 w-full items-center gap-2 border-b py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", canManage && "cursor-grab hover:bg-muted/40")}>
          <DriverAvatar name={driver.name} photoUrl={driver.profile_photo_url} /><span className="min-w-0"><span className="block break-words text-sm font-medium">{driverName(driver)}</span><span className="mt-1 block break-words text-xs text-muted-foreground">{driverAssignment(driver)}</span>{canManage && <Button variant="ghost" size="xs" className="mt-1" disabled={busy} aria-label={`Choose a run for ${driver.name}`} onClick={() => chooseDriver(driver)}>Choose run</Button>}</span></div>)}{!loading && data?.drivers.length === 0 && <p className="py-3 text-sm text-muted-foreground">No matching drivers.</p>}</div>
        <p className="shrink-0 px-4 py-2 text-[11px] text-muted-foreground">Assigned = an open run</p><Pagination page={data?.pagination.drivers} disabled={loading || busy} onChange={driver_page => setFilters(old => ({ ...old, driver_page }))} />
      </section>
      <section id="schedule-panel-runs" aria-label="Truck runs" className={cn("flex min-h-0 min-w-0 flex-col border-x bg-background", tab !== "runs" && "hidden @min-[1100px]:flex")}>
        <div className="shrink-0 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Truck runs <span className="ml-1 text-xs font-normal text-muted-foreground">{data?.pagination.trucks.total ?? ""} trucks</span></h2><div className="flex flex-wrap items-center gap-2">
          <select aria-label="Fleet status" className={cn(selectClass, "text-xs")} value={filters.fleet_status} disabled={busy} onChange={event => changeFilters({ fleet_status: event.target.value })}><option value="active">Active fleet</option><option value="inactive">Inactive fleet</option><option value="all">All fleet</option></select>
          <select aria-label="Fleet availability" className={cn(selectClass, "text-xs")} value={filters.availability} disabled={busy} onChange={event => changeFilters({ availability: event.target.value })}><option value="all">All availability</option><option value="available">Available</option><option value="busy">Ready / Active</option></select>
          {searchButton("runs", filters.truck_search)}</div></div>{searchInput("runs", "truck_search")}</div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4">{loading && !data ? <ScheduleColumnSkeleton column="runs" /> : data?.trucks.map(truck => <div key={truck.vehicle_id} data-schedule-truck-row onDragOver={event => over(event, truck.vehicle_id, truck.can_create || truck.runs.some(run => !!selected && eligibleRun(selected, run)))} onDragLeave={() => setHover(null)}
          onDrop={event => { if (!dragging) return; event.preventDefault(); setDragging(false); setHover(null); if (selected) truckTarget(truck, selected) }} className={cn("grid grid-cols-[112px_minmax(0,1fr)] border-b @min-[1100px]:grid-cols-[144px_minmax(0,1fr)]", hover === truck.vehicle_id && "ring-2 ring-inset ring-primary")}>
          <div className="min-w-0 border-r py-3 pr-2"><h3 className="flex items-start gap-1.5 text-[13px] font-medium"><Truck className="size-5 shrink-0 text-muted-foreground" /><span className="break-all">{truck.plate_number}</span></h3><p className="mt-1 text-[11px] text-muted-foreground">{truck.available ? "Available" : "In use"}</p>
            {truck.can_create && truck.runs.length > 0 && <Button variant="ghost" size="xs" className="mt-2" aria-label={`New run for ${truck.plate_number}`} disabled={busy} onClick={() => selected ? truckTarget(truck, selected) : openForm(truck)}><Plus className="size-3" />{selected ? "Choose run" : "New run"}</Button>}</div>
          <div className="min-w-0 space-y-2 p-2">{[...truck.runs.filter(run => run.status === "in_progress"), ...truck.runs.filter(run => run.status !== "in_progress" && run.overdue), ...truck.runs.filter(run => run.status !== "in_progress" && !run.overdue)].map(run => runCard(run, truck))}
            {!truck.runs.length && <div className="flex flex-wrap items-center gap-2 py-2 text-xs text-muted-foreground"><span>No runs planned</span>{truck.can_create && <Button variant="outline" size="sm" className="text-xs shadow-none" disabled={busy} onClick={() => selected ? truckTarget(truck, selected) : openForm(truck)}>New run</Button>}</div>}</div>
        </div>)}{!loading && data?.trucks.length === 0 && <p className="p-3 text-sm text-muted-foreground">No matching trucks.</p>}</div>
      </section>
      <section id="schedule-panel-shipments" aria-label="Unassigned shipments" onDragOver={event => over(event, "unassigned", selected?.kind === "shipment" && !!selected.shipment.source_run_id)} onDrop={event => { if (!dragging) return; event.preventDefault(); setDragging(false); if (selected?.kind === "shipment" && selected.shipment.source_run_id) void returnShipment(selected.shipment) }}
        className={cn("flex min-h-0 min-w-0 flex-col bg-background", tab !== "shipments" && "hidden @min-[1100px]:flex", hover === "unassigned" && "ring-2 ring-inset ring-primary")}>
        <div className="shrink-0 p-4"><div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">Shipments <span className="ml-1 text-xs font-normal text-muted-foreground">{data?.pagination.shipments.total ?? ""}</span></h2><div className="flex items-center gap-2">
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" aria-label="Filter shipment statuses" disabled={busy} className="relative shadow-none">Status{filters.shipment_statuses !== "all" && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />}</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end"><DropdownMenuLabel>Shipment status</DropdownMenuLabel><DropdownMenuCheckboxItem checked={filters.shipment_statuses === "all"} onSelect={event => event.preventDefault()} onCheckedChange={checked => changeFilters({ shipment_statuses: checked ? "all" : "none" })}>All</DropdownMenuCheckboxItem><DropdownMenuSeparator />
              {shipmentStatuses.map(status => <DropdownMenuCheckboxItem key={status} checked={filters.shipment_statuses === "all" || (filters.shipment_statuses ?? "").split(",").includes(status)} onSelect={event => event.preventDefault()} onCheckedChange={checked => { const selectedStatuses = filters.shipment_statuses === "all" ? shipmentStatuses : filters.shipment_statuses === "none" ? [] : (filters.shipment_statuses ?? "").split(","); const next = checked ? [...selectedStatuses, status] : selectedStatuses.filter(value => value !== status); changeFilters({ shipment_statuses: next.length === shipmentStatuses.length ? "all" : next.join(",") || "none" }) }}>{shipmentStatusLabel(status)}</DropdownMenuCheckboxItem>)}
            </DropdownMenuContent>
          </DropdownMenu>{searchButton("shipments", filters.shipment_search)}</div></div>{searchInput("shipments", "shipment_search")}</div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">{loading && !data ? <ScheduleColumnSkeleton column="shipments" /> : data?.shipments.map(shipment => shipmentCard(shipment, true))}{!loading && data?.shipments.length === 0 && <p className="py-3 text-sm text-muted-foreground">No unassigned shipments.</p>}</div>
        <Pagination page={data?.pagination.shipments} disabled={loading || busy} onChange={shipment_page => setFilters(old => ({ ...old, shipment_page }))} />
      </section>
    </div>
    <p role="status" aria-live="polite" className="shrink-0 border-t px-4 py-1 text-[11px] text-muted-foreground">{busy ? "Saving assignment…" : loading ? data ? "Refreshing schedule…" : "Loading schedule…" : "Runs created in the selected dates. Drag to a run or use Assign to run."}</p>
    {detail?.kind === "shipment" && <ShipmentMapDialog key={detail.id} open shipmentId={detail.id} accessToken={token} merchantId={merchantId} onOpenChange={closeDetails} />}
    <Drawer open={detail?.kind === "run"} onOpenChange={closeDetails}>
      <DrawerContent side="right" className="gap-0 overflow-hidden sm:w-[min(96vw,1200px)]">
        <DrawerHeader className="shrink-0 border-b pr-12"><DrawerTitle>Run details</DrawerTitle><DrawerDescription>Run information, recorded telemetry and actions.</DrawerDescription></DrawerHeader>
        {detail?.kind === "run" && <iframe key={detail.id} title="Run details" src={`/admin/messages/attachments/run/${encodeURIComponent(detail.id)}`} className="min-h-0 w-full flex-1 border-0" />}
      </DrawerContent>
    </Drawer>
    <Drawer open={detail?.kind === "driver"} onOpenChange={closeDetails}><DrawerContent side="right" className="sm:w-[min(96vw,1000px)]"><DrawerHeader className="sr-only"><DrawerTitle>Driver details</DrawerTitle><DrawerDescription>Driver profile and vehicle assignments.</DrawerDescription></DrawerHeader><div className="flex-1 overflow-y-auto p-4 pt-10">{detail?.kind === "driver" && <DriverDialogContent key={detail.id} driverId={detail.id} accessToken={token} merchantId={merchantId} />}</div></DrawerContent></Drawer>
    <Drawer open={!!driverTarget} onOpenChange={open => { if (!open && !busy) setDriverTarget(null) }}><DrawerContent side="right" className="sm:w-[480px]"><DrawerHeader><DrawerTitle>Choose a driver</DrawerTitle><DrawerDescription>Choose an active driver for this run. Replacing its driver requires confirmation.</DrawerDescription></DrawerHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-4"><Input aria-label="Search assignment drivers" placeholder="Search drivers…" value={filters.driver_search} disabled={busy} onChange={event => changeFilters({ driver_search: event.target.value })} />{data?.drivers.map(driver => <Button key={driver.driver_id} variant="ghost" className="h-auto w-full justify-start whitespace-normal border-b py-3 text-left" disabled={busy} onClick={() => chooseDriver(driver)}>{driver.name} · {driverAssignment(driver)}</Button>)}</div><Pagination page={data?.pagination.drivers} disabled={loading || busy} onChange={driver_page => setFilters(old => ({ ...old, driver_page }))} />
    </DrawerContent></Drawer>
    <Drawer open={!!picker} onOpenChange={open => { if (!open && !busy) setPicker(null) }}><DrawerContent side="right" className="sm:w-[480px]"><DrawerHeader><DrawerTitle>Choose a run</DrawerTitle><DrawerDescription>Assign {picker?.item.kind === "driver" ? picker.item.driver.name : picker?.item.shipment.reference} to a run, or create a new plan.</DrawerDescription></DrawerHeader>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">{truckChoices.map(truck => <div key={truck.vehicle_id} className="rounded-lg border p-3"><h3 className="mb-2 font-medium">{truck.plate_number}</h3><div className="grid gap-2">{truck.runs.filter(run => picker && eligibleRun(picker.item, run)).map(run => <Button key={run.run_id} className="h-auto justify-start whitespace-normal py-3 text-left" variant="outline" disabled={busy} onClick={() => picker && assign(picker.item, run)}>{statusName(run.status)} · {run.origin?.name || "Start not set"} → {run.destination?.name || "End not set"}</Button>)}
        {truck.can_create && <Button variant="secondary" disabled={busy} onClick={() => picker && openForm(truck, picker.item)}><Plus className="size-4" />Create run</Button>}</div></div>)}{!truckChoices.length && <p className="text-sm text-muted-foreground">No trucks match your filters.</p>}</div>
    </DrawerContent></Drawer>
    <Drawer open={!!form} onOpenChange={open => { if (!open && !busy) setForm(null) }}><DrawerContent side="right" className="sm:w-[480px]" showCloseButton={!busy}><DrawerHeader><DrawerTitle>{form?.run ? "Edit planned run" : "Create run"}</DrawerTitle><DrawerDescription>{form?.truck.plate_number} · {timezone}</DrawerDescription></DrawerHeader>
      <form onSubmit={submitRun} className="flex min-h-0 flex-1 flex-col"><div className="flex-1 space-y-5 overflow-y-auto p-4">
        {form?.item && <p className="rounded-lg bg-muted p-3 text-sm">{form.item.kind === "driver" ? `Driver: ${form.item.driver.name}` : `Shipment: ${form.item.shipment.reference}`}</p>}
        <div className="grid gap-2"><Label>Start location</Label><LocationCombobox merchantId={merchantId} environmentId={null} token={token} value={origin} onChange={location => { setOrigin(location); setForm(old => old && { ...old, requestId: crypto.randomUUID() }) }} disabled={busy} /></div>
        <div className="grid gap-2"><Label>End location</Label><LocationCombobox merchantId={merchantId} environmentId={null} token={token} value={destination} onChange={location => { setDestination(location); setForm(old => old && { ...old, requestId: crypto.randomUUID() }) }} disabled={busy} /></div>
        <div className="grid gap-2"><Label htmlFor="planned-start">Planned start ({timezone})</Label><Input id="planned-start" required type="datetime-local" value={plannedTime} onChange={event => { setPlannedTime(event.target.value); setForm(old => old && { ...old, requestId: crypto.randomUUID() }) }} disabled={busy} /></div>
        <p className="text-sm text-muted-foreground">Runs become ready on their planned day when a driver, available truck and shipment are assigned. Earlier runs must close first.</p>
        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
      </div><DrawerFooter><Button type="submit" disabled={busy}>{busy ? "Saving…" : form?.run ? "Save plan" : "Create run"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setForm(null)}>Cancel</Button></DrawerFooter></form>
    </DrawerContent></Drawer>
  </div>
}
