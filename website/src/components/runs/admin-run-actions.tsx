"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, MessageSquare, Pencil, ListOrdered } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LocationCombobox } from "@/components/locations/location-combobox"
import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import { getRun } from "@/lib/api/runs"
import type { ApiEnvelope, Location, Run } from "@/lib/types"
import { moveDelivery, type DeliveryOrderRow } from "./run-action-utils"

export function AdminRunActions({ run, token }: { run: Run; token: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<"edit" | "order" | null>(null)
  const [origin, setOrigin] = useState<Location | null>(null)
  const [destination, setDestination] = useState<Location | null>(null)
  const [expected, setExpected] = useState({ origin: null as string | null, destination: null as string | null })
  const [rows, setRows] = useState<DeliveryOrderRow[]>([])
  const [expectedIds, setExpectedIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [conflict, setConflict] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const flight = useRef(false)
  const epoch = useRef(0)
  useEffect(() => () => { epoch.current++ }, [])
  const base = `/api/v1/runs/${run.run_id}`
  const ids = rows.map(row => row.shipment_id)
  const changed = mode === "order" ? ids.join() !== expectedIds.join()
    : origin?.location_id !== expected.origin || destination?.location_id !== expected.destination

  async function load(next: "edit" | "order") {
    if (flight.current) return
    const version = ++epoch.current
    flight.current = true; setBusy(true); setError(""); setLoaded(false); setDragging(null)
    try {
      if (next === "edit") {
        const latest = await getRun(run.run_id, token)
        if (version !== epoch.current) return
        if (isApiErrorResponse(latest)) throw new Error(latest.message)
        if (!latest.can_edit_endpoints) throw new Error("This run can no longer be edited. Refresh the run.")
        setOrigin(latest.planned_origin ?? null); setDestination(latest.planned_destination ?? null)
        setExpected({ origin: latest.planned_origin?.location_id ?? null, destination: latest.planned_destination?.location_id ?? null })
      } else {
        const result = await apiFetch<ApiEnvelope<{ shipments: DeliveryOrderRow[] }>>(`${base}/delivery-order`, { token })
        if (version !== epoch.current) return
        if (isApiErrorResponse(result)) throw new Error(result.message)
        setRows(result.data.shipments); setExpectedIds(result.data.shipments.map(row => row.shipment_id))
      }
      setConflict(false); setLoaded(true)
    } catch (e) { if (version === epoch.current) setError(e instanceof Error ? e.message : "Unable to load run actions.") }
    finally { flight.current = false; if (version === epoch.current) setBusy(false) }
  }
  function open(next: "edit" | "order") { setMode(next); setConflict(false); void load(next) }
  function close() { if (flight.current) return; epoch.current++; setMode(null); setError(""); setDragging(null) }
  async function save() {
    if (flight.current || !loaded || conflict || !changed) return
    const version = epoch.current
    flight.current = true; setBusy(true); setError("")
    try {
      const result = await apiFetch<ApiEnvelope<unknown>>(`${base}/${mode === "edit" ? "endpoints" : "delivery-order"}`, {
        token, method: "PATCH", body: mode === "edit" ? {
          origin_location_id: origin?.location_id, destination_location_id: destination?.location_id,
          expected_origin_location_id: expected.origin, expected_destination_location_id: expected.destination,
        } : { shipment_ids: ids, expected_shipment_ids: expectedIds },
      })
      if (version !== epoch.current) return
      if (isApiErrorResponse(result)) { setError(result.message); setConflict(result.status === 409); return }
      setMode(null); toast.success(mode === "edit" ? "Run locations updated." : "Delivery order updated."); router.refresh()
    } catch { if (version === epoch.current) setError("Unable to save. Your changes are retained; try again.") }
    finally { flight.current = false; if (version === epoch.current) setBusy(false) }
  }
  if (!run.can_edit_endpoints && !run.can_update_delivery_order && !run.can_message_driver) return null
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline">Actions<ChevronDown className="size-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {run.can_edit_endpoints && <DropdownMenuItem onSelect={() => open("edit")}><Pencil />Edit run</DropdownMenuItem>}
        {run.can_update_delivery_order && <DropdownMenuItem onSelect={() => open("order")}><ListOrdered />Update delivery order</DropdownMenuItem>}
        {run.can_message_driver && <><DropdownMenuItem disabled={!run.driver?.driver_id} onSelect={() => router.push(`/admin/messages?${new URLSearchParams({ merchant_id: run.merchant_id ?? "", run_id: run.run_id, handoff: crypto.randomUUID() })}`)}><MessageSquare />Message the driver</DropdownMenuItem>
          {!run.driver?.driver_id && <p className="max-w-60 px-2 py-1 text-xs text-muted-foreground">Assign a driver to message them.</p>}</>}
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={mode !== null} onOpenChange={next => { if (!next) close() }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl" showCloseButton={!busy} onEscapeKeyDown={event => { if (busy) event.preventDefault() }} onPointerDownOutside={event => { if (busy) event.preventDefault() }}>
        <DialogHeader><DialogTitle>{mode === "edit" ? "Edit run" : "Update delivery order"}</DialogTitle><DialogDescription>{mode === "edit" ? "Change the planned start and end locations. Recorded visits stay unchanged." : "Reorder remaining deliveries. Completed and other terminal deliveries retain their positions."}</DialogDescription></DialogHeader>
        {busy && !loaded && <p role="status">Loading…</p>}
        {loaded && mode === "edit" && <div className="space-y-4">
          <div className="space-y-2"><p id="run-origin-label" className="text-sm font-medium">Planned start location</p><div role="group" aria-labelledby="run-origin-label"><LocationCombobox value={origin} onChange={setOrigin} token={token} merchantId={run.merchant_id} environmentId={run.environment_id ?? null} allowCreate={false} disabled={busy || conflict} /></div></div>
          <div className="space-y-2"><p id="run-destination-label" className="text-sm font-medium">Planned end location</p><div role="group" aria-labelledby="run-destination-label"><LocationCombobox value={destination} onChange={setDestination} token={token} merchantId={run.merchant_id} environmentId={run.environment_id ?? null} allowCreate={false} disabled={busy || conflict} /></div></div>
        </div>}
        {loaded && mode === "order" && <ol className="max-h-[45dvh] space-y-2 overflow-y-auto" aria-label="Remaining delivery order">
          {!rows.length && <li className="text-sm text-muted-foreground">No remaining deliveries.</li>}
          {rows.map((row, index) => <li key={row.shipment_id} className="flex items-center gap-2 rounded-lg border p-3" onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "move" }} onDrop={event => { event.preventDefault(); if (!busy && !conflict && dragging !== null) setRows(current => moveDelivery(current, dragging, index)); setDragging(null) }}>
            <button type="button" draggable={!busy && !conflict} disabled={busy || conflict} aria-label={`Drag ${row.reference}`} className="cursor-grab touch-none p-1" onDragStart={event => { setDragging(index); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", row.shipment_id) }} onDragEnd={() => setDragging(null)}><GripVertical className="size-4" /></button>
            <span className="text-sm tabular-nums">{index + 1}.</span><div className="min-w-0 flex-1 text-sm"><p className="break-words font-medium">{row.reference}</p><p className="break-words text-muted-foreground">{row.destination || row.address || "Destination unavailable"}</p></div>
            <div className="flex shrink-0 flex-col gap-1"><Button size="icon" variant="ghost" aria-label={`Move ${row.reference} earlier`} disabled={busy || conflict || index === 0} onClick={() => setRows(current => moveDelivery(current, index, index - 1))}><ArrowUp className="size-4" /></Button><Button size="icon" variant="ghost" aria-label={`Move ${row.reference} later`} disabled={busy || conflict || index === rows.length - 1} onClick={() => setRows(current => moveDelivery(current, index, index + 1))}><ArrowDown className="size-4" /></Button></div>
          </li>)}
        </ol>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          {(conflict || (!loaded && error)) && <Button variant="outline" disabled={busy} onClick={() => mode && void load(mode)}>{mode === "edit" ? "Reload run locations" : "Reload delivery order"}</Button>}
          <Button variant="outline" disabled={busy} onClick={close}>Cancel</Button>
          <Button disabled={busy || !loaded || conflict || dragging !== null || !changed || (mode === "edit" && (!origin || !destination))} onClick={() => void save()}>{busy && loaded ? "Saving…" : mode === "edit" ? "Save locations" : "Save delivery order"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
