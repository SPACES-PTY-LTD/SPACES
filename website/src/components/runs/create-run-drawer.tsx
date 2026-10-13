"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileUp, Loader2, Plus, Route, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { LocationCombobox } from "@/components/locations/location-combobox"
import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import { analyzeDeliveryNote, getDeliveryNoteAnalysis } from "@/lib/api/delivery-note-imports"
import { listMerchantEnvironments } from "@/lib/api/merchants"
import { pollDocumentImport } from "@/lib/delivery-note-analysis-poll"
import { emptyRunDraft, extractedRows, hasMapPosition, eligibleManualShipment, validateDocumentFile, quantityUnits, type RunDraft, type ImportRow, type ImportReview } from "@/lib/admin-run-import"
import { merchantTimeToIso } from "@/components/schedule/schedule-utils"
import { formatAddress } from "@/lib/address"
import { AdminRoute } from "@/lib/routes/admin"
import type { ApiEnvelope, ApiListResponse, DeliveryNoteExtraction, Location, Merchant, MerchantEnvironment, Run } from "@/lib/types"

const stepNames = ["Upload", "Reading", "Trip locations", "Shipments", "Confirm"]
const title = (location?: Location | null) => location?.name || location?.company || location?.full_address || "Not selected"

export function CreateRunDrawer({ token, userId, merchants, selectedMerchantId, isSuperAdmin = false }: { token: string; userId: string; merchants: Merchant[]; selectedMerchantId?: string; isSuperAdmin?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [locked, setLocked] = React.useState(false)
  const [merchantId, setMerchantId] = React.useState(selectedMerchantId ?? "")
  const [environmentId, setEnvironmentId] = React.useState("")
  const [environments, setEnvironments] = React.useState<MerchantEnvironment[]>([])
  const [contextError, setContextError] = React.useState("")
  const [contextLoading, setContextLoading] = React.useState(false)
  const [contextAttempt, setContextAttempt] = React.useState(0)
  React.useEffect(() => {
    if (!open || !merchantId) return
    let active = true
    Promise.resolve().then(async () => {
      if (!active) return
      setContextLoading(true); setContextError("")
      const response = await listMerchantEnvironments(merchantId, token)
      if (!active) return
      setContextLoading(false)
      if (isApiErrorResponse(response)) { setContextError(response.message); return }
      setEnvironments(response.data)
    })
    return () => { active = false }
  }, [open, merchantId, token, contextAttempt])
  const merchant = merchants.find(item => item.merchant_id === merchantId)
  const canCreate = !!merchant && (isSuperAdmin || merchant.access?.permissions.can_create_update_resources === true)
  return <>
    <Button className="min-h-11" onClick={() => setOpen(true)}><Plus className="size-4" />Create Run</Button>
    <Drawer open={open} onOpenChange={next => { if (!locked) setOpen(next) }}>
      <DrawerContent side="right" className="sm:w-[min(96vw,900px)]">
        <DrawerHeader><DrawerTitle>Create Run</DrawerTitle><DrawerDescription>Create a draft run from a delivery note or enter the details manually.</DrawerDescription></DrawerHeader>
        <div className="grid shrink-0 gap-3 border-b p-4 sm:grid-cols-2">
          <Field label="Merchant"><select aria-label="Merchant" className="h-11 w-full rounded-md border bg-background px-3" value={merchantId} disabled={locked || !!selectedMerchantId} onChange={event => { setMerchantId(event.target.value); setEnvironmentId(""); setEnvironments([]) }}><option value="">Select merchant</option>{merchants.map(item => <option key={item.merchant_id} value={item.merchant_id}>{item.name}</option>)}</select></Field>
          <Field label="Environment"><select aria-label="Environment" className="h-11 w-full rounded-md border bg-background px-3" value={environmentId} disabled={locked || contextLoading} onChange={event => setEnvironmentId(event.target.value)}><option value="">No environment</option>{environments.map(item => <option key={item.environment_id} value={item.environment_id}>{item.name}</option>)}</select></Field>
          {contextError && <p role="alert" className="text-sm text-destructive">{contextError} <Button variant="outline" onClick={() => setContextAttempt(value => value + 1)}>Retry</Button></p>}
        </div>
        {open && canCreate && !contextLoading && !contextError ? <RunCreation key={`${userId}:${merchantId}:${environmentId}`} token={token} userId={userId} merchant={merchant!} environmentId={environmentId} onLock={setLocked} onClose={() => setOpen(false)} /> : <p className="p-4 text-sm text-muted-foreground">{contextLoading ? "Loading merchant context…" : !merchantId ? "Select a merchant to continue." : !canCreate ? "You don’t have permission to create runs for this merchant." : "Retry loading the merchant context to continue."}</p>}
      </DrawerContent>
    </Drawer>
  </>
}

function RunCreation({ token, userId, merchant, environmentId, onClose, onLock }: { token: string; userId: string; merchant: Merchant; environmentId: string; onClose: () => void; onLock: (locked: boolean) => void }) {
  const router = useRouter()
  const storageKey = `admin-run-draft:${userId}:${merchant.merchant_id}:${environmentId || "none"}`
  const [draft, setDraft] = React.useState<RunDraft>(emptyRunDraft)
  const [ready, setReady] = React.useState(false)
  const [mode, setMode] = React.useState<"choice" | "document" | "manual">("choice")
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [readingMessage, setReadingMessage] = React.useState("")
  const [review, setReview] = React.useState<ImportReview | null>(null)
  const [extraction, setExtraction] = React.useState<DeliveryNoteExtraction | null>(null)
  const [result, setResult] = React.useState<string | null>(null)
  const operation = React.useRef<AbortController | null>(null)
  const fileInput = React.useRef<HTMLInputElement>(null)
  const lastFile = React.useRef<File | undefined>(undefined)
  const forget = () => { try { localStorage.removeItem(storageKey) } catch { /* Keep recovery in memory. */ } }
  const context = { merchant_id: merchant.merchant_id, environment_id: environmentId || undefined }
  const timezone = merchant.timezone || "UTC"
  const remember = React.useCallback((next: RunDraft) => { try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* In-memory draft remains usable. */ } }, [storageKey])
  React.useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (!active) return
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "null")
        if (saved?.importId && Array.isArray(saved.rows)) { setDraft({ ...emptyRunDraft(), ...saved, step: saved.analyzed ? 3 : 2 }); setExtraction(saved.extraction ?? null) }
      } catch { /* Ignore an invalid stored draft. */ }
      setReady(true)
    })
    return () => { active = false; operation.current?.abort() }
  }, [storageKey])
  React.useEffect(() => { if (ready && draft.importId && !result) remember(draft) }, [draft, ready, remember, result])
  const patch = (values: Partial<RunDraft>) => { setDraft(current => ({ ...current, ...values })); if (values.rows || values.origin || values.destination) setReview(null); setError("") }
  const patchRow = (index: number, values: Partial<ImportRow>) => patch({ rows: draft.rows.map((row, position) => position === index ? { ...row, ...values } : row) })
  const requestBody = () => ({ ...context,
    origin_location_id: draft.origin?.location_id ?? null, destination_location_id: draft.destination?.location_id ?? null,
    driver_id: draft.driver_id || null, vehicle_id: draft.vehicle_id || null,
    planned_start_at: draft.planned_start_at ? merchantTimeToIso(draft.planned_start_at, timezone) : null,
    service_area: draft.service_area || null, notes: draft.notes || null, delivery_note_number: draft.delivery_note_number || null,
    line_items: draft.rows.map(row => ({ ...row, pickup: undefined, dropoff: undefined, quantity: row.quantity === "" ? null : Number(row.quantity) })),
  })
  async function resumeDocument() {
    if (operation.current) return
    let recovered = draft
    if (!recovered.importId) {
      try { const saved = JSON.parse(localStorage.getItem(storageKey) || "null"); if (saved?.importId && Array.isArray(saved.rows)) recovered = { ...emptyRunDraft(), ...saved, step: saved.analyzed ? 3 : 2 } } catch { /* Use current draft. */ }
    }
    setDraft(recovered); setExtraction(recovered.extraction ?? null); setMode("document"); setError("")
    if (!recovered.importId) return
    const controller = new AbortController(); operation.current = controller; setBusy(true)
    try {
      const response = await getDeliveryNoteAnalysis(recovered.importId, merchant.merchant_id, token, controller.signal, environmentId || null)
      if (controller.signal.aborted) return
      if (isApiErrorResponse(response)) throw new Error(response.message)
      if (response.data.status === "confirmed" && response.data.confirmation_result?.run_id) { setResult(response.data.confirmation_result.run_id); forget(); router.refresh() }
      else if (response.data.status === "failed") { setDraft(current => ({ ...current, step: 1, analyzed: false, importId: "" })); forget(); throw new Error(response.data.failure_message || "Reading failed. Choose another document.") }
    } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Unable to resume this document.") }
    finally { if (operation.current === controller) { operation.current = null; setBusy(false) } }
  }
  async function readDocument(file?: File) {
    if (operation.current) return
    const controller = new AbortController(); operation.current = controller
    setBusy(true); setError(""); setReadingMessage(file ? "Uploading your file for analysis…" : "Checking document processing…")
    if (file) lastFile.current = file
    const next = file ? { ...emptyRunDraft(), importId: crypto.randomUUID(), filename: file.name, step: 2 } : { ...draft, step: 2 }
    setDraft(next); remember(next)
    try {
      if (file) {
        const response = await analyzeDeliveryNote(null, file, token, { importId: next.importId, merchantId: merchant.merchant_id, environmentId: environmentId || null, signal: controller.signal })
        if (controller.signal.aborted) return
        if (isApiErrorResponse(response) && response.status && response.status < 500 && ![408, 429].includes(response.status)) {
          setDraft(current => ({ ...current, importId: "", step: 1 })); forget()
          throw new Error(response.message)
        }
      }
      if (controller.signal.aborted) return
      const response = await pollDocumentImport(async signal => {
        const status = await getDeliveryNoteAnalysis(next.importId, merchant.merchant_id, token, signal, environmentId || null)
        if (isApiErrorResponse(status)) throw Object.assign(new Error(status.message), { status: status.status })
        return status.data
      }, controller.signal, () => setReadingMessage("Reading delivery details…"))
      if (controller.signal.aborted) return
      if (response.status === "failed") { setDraft(current => ({ ...current, step: 1, importId: "" })); forget(); throw new Error(response.failure_message || "Reading failed. Choose another document.") }
      if (response.status === "confirmed") {
        if (response.confirmation_result?.run_id) { setResult(response.confirmation_result.run_id); forget(); router.refresh(); return }
        throw new Error("This document has already been confirmed. Choose another document.")
      }
      const data = response.extracted_data
      if (!data) throw new Error("Document details are unavailable. Check processing status again.")
      setExtraction(data)
      setDraft(current => ({ ...current, analyzed: true, extraction: data, step: 3, delivery_note_number: data.delivery_note_number ?? "", rows: extractedRows(data) }))
    } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Unable to read the document.") }
    finally { if (operation.current === controller) { operation.current = null; setBusy(false) } }
  }
  async function preview(nextStep?: number) {
    if (operation.current) return
    const controller = new AbortController(); operation.current = controller; setBusy(true); setError("")
    try {
      const response = await apiFetch<ApiEnvelope<ImportReview>>(`/api/v1/delivery-note-imports/${draft.importId}/preview`, { method: "POST", token, body: requestBody(), signal: controller.signal })
      if (controller.signal.aborted) return
      if (isApiErrorResponse(response)) throw new Error(response.message)
      setReview(response.data)
      if (nextStep === 4 || (nextStep === 5 && response.data.can_confirm)) setDraft(current => ({ ...current, step: nextStep }))
      if (nextStep === 5 && !response.data.can_confirm) setError("Resolve the highlighted shipment details before continuing.")
    } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Unable to review shipments.") }
    finally { if (operation.current === controller) { operation.current = null; setBusy(false) } }
  }
  async function create() {
    if (operation.current) return
    const controller = new AbortController(); operation.current = controller; setBusy(true); setSaving(true); onLock(true); setError("")
    try {
      const response = mode === "document"
        ? await apiFetch<ApiEnvelope<{ run_id: string }>>(`/api/v1/delivery-note-imports/${draft.importId}/confirm`, { method: "POST", token, body: requestBody(), signal: controller.signal })
        : await apiFetch<ApiEnvelope<Run>>("/api/v1/runs", { method: "POST", token, body: { ...requestBody(), shipment_ids: draft.shipment_ids }, signal: controller.signal })
      if (controller.signal.aborted) return
      if (isApiErrorResponse(response)) throw new Error(response.message)
      const runId = response.data.run_id
      router.refresh()
      if (mode === "manual") { onClose(); router.push(AdminRoute.runDetails(runId)); return }
      setResult(runId); forget()
    } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Unable to create the run.") }
    finally { if (operation.current === controller) { operation.current = null; setBusy(false); setSaving(false); onLock(false) } }
  }
  const tripReady = hasMapPosition(draft.origin) && hasMapPosition(draft.destination)
  const fields = <>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Driver (optional)"><ResourcePicker kind="drivers" label="driver" token={token} context={context} selected={draft.driver_id} onSelect={id => patch({ driver_id: id })} /></Field><Field label="Vehicle (optional)"><ResourcePicker kind="vehicles" label="vehicle" token={token} context={context} selected={draft.vehicle_id} onSelect={id => patch({ vehicle_id: id })} /></Field></div>
    <Field label={`Planned start (optional · ${timezone})`}><Input aria-label="Planned start" type="datetime-local" value={draft.planned_start_at} onChange={event => patch({ planned_start_at: event.target.value })} /></Field>
    <Field label="Service area (optional)"><Input aria-label="Service area" value={draft.service_area} onChange={event => patch({ service_area: event.target.value })} /></Field>
    <Field label="Notes (optional)"><Textarea aria-label="Notes" value={draft.notes} onChange={event => patch({ notes: event.target.value })} /></Field>
  </>
  const locations = <div className="grid gap-4 sm:grid-cols-2">{(["origin", "destination"] as const).map(key => <Field key={key} label={key === "origin" ? "Run starting point" : "Planned end location"}><LocationCombobox ariaLabel={key === "origin" ? "Run starting point" : "Planned end location"} token={token} merchantId={merchant.merchant_id} environmentId={environmentId || null} allowCreate={false} value={draft[key]} onChange={location => patch({ [key]: location })} />{draft[key] && <p className="text-sm text-muted-foreground">{formatAddress(draft[key]!)}</p>}</Field>)}</div>
  return <>
    {/* A submitted confirmation must finish before the enclosing dialog can dismiss. */}
    {saving && <div className="absolute inset-0 z-10 cursor-wait rounded-lg bg-background/70" aria-label="Saving run"><p role="status" className="flex h-full items-center justify-center gap-2"><Loader2 className="size-5 animate-spin" />Creating your run…</p></div>}
    {mode === "document" && !result && <nav aria-label="Run creation steps" className="grid shrink-0 grid-cols-5 gap-1 border-b px-4 py-3">{stepNames.map((name, index) => <button key={name} type="button" disabled={busy || index + 1 >= draft.step || index < 2} onClick={() => patch({ step: index + 1 })} aria-current={draft.step === index + 1 ? "step" : undefined} className={`min-h-11 rounded-md px-1 py-2 text-xs sm:text-sm ${draft.step === index + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{index + 1}<span className="mt-1 block">{name}</span></button>)}</nav>}
    <fieldset disabled={busy} className="min-w-0 min-h-0 flex-1 space-y-5 overflow-y-auto p-4 [&_input]:min-h-11 [&_button]:min-h-11 [&_select]:min-h-11">
      {!ready ? <p role="status">Checking for an unfinished upload…</p> : result ? <div className="space-y-4 py-10 text-center"><CheckCircle2 className="mx-auto size-12 text-green-600" /><h2 className="text-xl font-semibold">Run created</h2><p>Your reviewed shipments have been attached to the new draft run.</p><Button asChild><Link href={AdminRoute.runDetails(result)} onClick={onClose}>View run</Link></Button></div> : mode === "choice" ? <div className="grid gap-4 sm:grid-cols-2"><Choice icon={<FileUp />} heading="Create from a delivery note" description="We’ll extract as much information about the delivery as possible. You’ll review and confirm it before creating the run." onClick={() => void resumeDocument()} /><Choice icon={<Route />} heading="Create manually from scratch" description="Enter run details and select existing shipments." onClick={() => { setDraft(emptyRunDraft()); setMode("manual") }} /></div> : <>
        {mode === "document" && draft.step <= 2 && <>
          <h2 className="text-lg font-semibold">{draft.step === 2 ? "Reading document" : "Upload delivery note"}</h2>
          {draft.filename && <p className="break-all text-sm">{draft.filename}</p>}
          {busy ? <p role="status" aria-live="polite" className="flex items-center gap-2"><Loader2 className="size-5 animate-spin motion-reduce:animate-none" />{readingMessage}</p> : draft.importId ? <div className="rounded-lg bg-muted p-4"><p>Continue with your unfinished upload.</p><Button className="mt-3" onClick={() => void readDocument()}>Check processing status</Button></div> : null}
          {!busy && lastFile.current && !draft.importId && <Button variant="outline" onClick={() => void readDocument(lastFile.current)}>Retry reading document</Button>}
          {!busy && <button type="button" onClick={() => fileInput.current?.click()} className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center"><FileUp className="size-8 text-primary" /><span className="font-semibold">{draft.importId ? "Choose another document" : "Upload a delivery note"}</span><span className="text-sm text-muted-foreground">PDF, JPG, PNG or WebP · up to 20 MB</span><span className="rounded-md bg-primary px-4 py-3 text-primary-foreground">Choose document</span></button>}
        </>}
        <input ref={fileInput} tabIndex={-1} aria-label="Choose delivery note" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="sr-only" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; const message = validateDocumentFile(file); if (message) { setError(message); return } void readDocument(file) }} />
        {mode === "document" && draft.analyzed && draft.step === 3 && <><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Confirm trip locations</h2><Button variant="outline" onClick={() => fileInput.current?.click()}>Change document</Button></div><p className="text-sm text-muted-foreground">Shipment stops sit between these locations. Choose saved locations with a confirmed map position.</p>{extraction && <p className="rounded-lg bg-muted p-3 text-sm">From document: {extraction.pickup_address?.name || formatAddress(extraction.pickup_address as Location) || "Collection unavailable"} → {extraction.dropoff_address?.name || formatAddress(extraction.dropoff_address as Location) || "Delivery unavailable"}</p>}{locations}{!tripReady && <p className="text-sm text-muted-foreground">Choose both locations with a confirmed map position to continue.</p>}</>}
        {mode === "document" && draft.step === 4 && <>
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Review shipments</h2><Button variant="outline" onClick={() => patch({ rows: [...draft.rows, { merchant_order_ref: "", description: "", quantity: 1, quantity_unit: "units", collection_date: "" }] })}>Add shipment</Button></div>
          <Field label="Delivery note number"><Input aria-label="Delivery note number" value={draft.delivery_note_number} onChange={event => patch({ delivery_note_number: event.target.value })} /></Field>
          {draft.rows.map((row, index) => { const state = review?.rows.find(item => item.index === index); return <article key={index} className="space-y-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{row.merchant_order_ref || `Shipment ${index + 1}`}</h3><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!!row.excluded} onChange={event => patchRow(index, { excluded: event.target.checked })} />Exclude shipment</label></div>
            {state?.eligibility === "existing" && <p className="rounded-md bg-muted p-3 text-sm">This reference already exists and will be skipped. Existing shipments are not moved.</p>}
            <fieldset disabled={row.excluded || busy} className="grid gap-4 disabled:opacity-50 sm:grid-cols-2">
              <Field label="Shipment reference"><Input aria-label={`Shipment ${index + 1} reference`} value={row.merchant_order_ref ?? ""} onChange={event => patchRow(index, { merchant_order_ref: event.target.value })} /></Field>
              <Field label="Description"><Input aria-label={`Shipment ${index + 1} description`} value={row.description ?? ""} onChange={event => patchRow(index, { description: event.target.value })} /></Field>
              <Field label="Quantity"><Input aria-label={`Shipment ${index + 1} quantity`} type="number" step={['liters', 'kilograms', 'tonnes', 'cubic_metres'].includes(row.quantity_unit) ? "any" : "1"} min="0" value={row.quantity} onChange={event => patchRow(index, { quantity: event.target.value })} /></Field>
              <Field label="Unit"><select aria-label={`Shipment ${index + 1} unit`} className="w-full rounded-md border bg-background px-3" value={row.quantity_unit} onChange={event => patchRow(index, { quantity_unit: event.target.value })}>{quantityUnits.map(unit => <option key={unit} value={unit}>{unit.replaceAll("_", " ")}</option>)}</select></Field>
              <Field label="Collection date"><Input aria-label={`Shipment ${index + 1} collection date`} type="date" value={row.collection_date} onChange={event => patchRow(index, { collection_date: event.target.value })} /></Field>
              <p className="self-center text-sm text-muted-foreground">Shipment type: Standard</p>
              {(["pickup", "dropoff"] as const).map(key => <Field key={key} label={key === "pickup" ? "Collection location" : "Delivery location"}><LocationCombobox ariaLabel={`Shipment ${index + 1} ${key === "pickup" ? "collection location" : "delivery location"}`} token={token} merchantId={merchant.merchant_id} environmentId={environmentId || null} allowCreate={false} value={row[key]} onChange={location => patchRow(index, { [key]: location, [`${key}_location_id`]: location.location_id })} />{!row[key] && extraction && <p className="text-xs text-muted-foreground">From document: {formatAddress((key === "pickup" ? extraction.pickup_address : extraction.dropoff_address) as Location) || "Not provided"}</p>}{key === "pickup" && !row.pickup && draft.origin && <Button variant="outline" onClick={() => patchRow(index, { pickup: draft.origin, pickup_location_id: draft.origin?.location_id })}>Use run starting point</Button>}</Field>)}
              <Field label="Pickup instructions"><Textarea aria-label={`Shipment ${index + 1} pickup instructions`} value={row.pickup_instructions ?? ""} onChange={event => patchRow(index, { pickup_instructions: event.target.value })} /></Field>
              <Field label="Delivery instructions"><Textarea aria-label={`Shipment ${index + 1} delivery instructions`} value={row.dropoff_instructions ?? ""} onChange={event => patchRow(index, { dropoff_instructions: event.target.value })} /></Field>
              {(["weight", "length_cm", "width_cm", "height_cm"] as const).map(key => <Field key={key} label={key === "weight" ? "Weight kg (optional)" : `${key.replace("_cm", "")} cm (optional)`}><Input aria-label={`Shipment ${index + 1} ${key}`} type="number" step="any" min="0.01" value={row[key] ?? ""} onChange={event => patchRow(index, { [key]: event.target.value === "" ? null : Number(event.target.value) })} /></Field>)}
            </fieldset>
            {!row.excluded && row.pickup_location_id && draft.origin?.location_id && row.pickup_location_id !== draft.origin.location_id && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">The shipment collection location differs from the run starting point: {title(row.pickup)} / {title(draft.origin)}. Edit this shipment or <button className="underline" onClick={() => patch({ step: 3 })}>change run start</button>.</p>}
            {state?.validation_warnings.map(message => <p key={message} className="text-sm text-destructive">{message}</p>)}
          </article> })}
          {review?.warnings.map(message => <p key={message} className="text-sm text-destructive">{message}</p>)}
        </>}
        {mode === "document" && draft.step === 5 && <><h2 className="text-lg font-semibold">Confirm and create</h2><div className="space-y-2 rounded-xl bg-muted p-4"><p className="font-medium">{title(draft.origin)} → {title(draft.destination)}</p><p>{draft.rows.filter((row, index) => !row.excluded && review?.rows.find(item => item.index === index)?.eligibility !== "existing").length} shipments included</p>{draft.rows.filter((row, index) => !row.excluded && review?.rows.find(item => item.index === index)?.eligibility !== "existing").map((row, index) => <p key={index} className="text-sm">{row.merchant_order_ref} · {row.quantity} {row.quantity_unit.replaceAll("_", " ")} · {title(row.dropoff)}</p>)}</div>{fields}<p className="text-sm text-muted-foreground">Driver and vehicle can be assigned later. This creates a draft run.</p></>}
        {mode === "manual" && <><h2 className="text-lg font-semibold">Create manually from scratch</h2>{locations}{fields}<Field label="Existing shipments (optional)"><ResourcePicker kind="shipments" label="shipments" token={token} context={context} multiple selected={draft.shipment_ids} onSelect={id => patch({ shipment_ids: draft.shipment_ids.includes(id) ? draft.shipment_ids.filter(value => value !== id) : [...draft.shipment_ids, id] })} /></Field><p className="text-sm text-muted-foreground">{draft.shipment_ids.length} shipments selected. You can also add shipments after creating the run.</p></>}
      </>}
      {error && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}</p>}
    </fieldset>
    <DrawerFooter>
      <Button variant="outline" disabled={saving} onClick={() => { if (busy) { operation.current?.abort(); operation.current = null; setBusy(false) } onClose() }}>{busy ? "Check later" : "Close"}</Button>
      {!result && mode !== "choice" && <Button variant="outline" disabled={busy} onClick={() => { if (mode === "document" && draft.step > 3) patch({ step: draft.step - 1 }); else setMode("choice") }}>Back</Button>}
      {!result && mode === "document" && draft.step === 3 && <Button disabled={busy || !tripReady} onClick={() => void preview(4)}>{busy ? "Checking…" : "Review shipments"}</Button>}
      {!result && mode === "document" && draft.step === 4 && <Button disabled={busy} onClick={() => void preview(5)}>{busy ? "Checking…" : "Continue"}</Button>}
      {!result && (mode === "manual" || (mode === "document" && draft.step === 5)) && <Button disabled={busy || (mode === "document" && !tripReady)} onClick={() => void create()}>Create Run</Button>}
    </DrawerFooter>
  </>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><p className="text-sm font-medium">{label}</p>{children}</div> }
function Choice({ icon, heading, description, onClick }: { icon: React.ReactNode; heading: string; description: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex flex-col gap-3 rounded-xl border p-5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">{icon}<span className="font-semibold">{heading}</span><span className="text-sm text-muted-foreground">{description}</span></button> }

type Resource = { driver_id?: string; vehicle_id?: string; shipment_id?: string; name?: string; plate_number?: string; ref_code?: string; merchant_order_ref?: string; status?: string; run_id?: string | null; run_status?: string | null; run_shipment_status?: string | null; merchant_id?: string; environment_id?: string | null }
function ResourcePicker({ kind, label, token, context, selected, onSelect, multiple }: { kind: "drivers" | "vehicles" | "shipments"; label: string; token: string; context: { merchant_id: string; environment_id?: string }; selected: string | string[]; onSelect: (id: string) => void; multiple?: boolean }) {
  const [query, setQuery] = React.useState("")
  const [options, setOptions] = React.useState<Resource[]>([])
  const [page, setPage] = React.useState(1)
  const [lastPage, setLastPage] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [attempt, setAttempt] = React.useState(0)
  const [selectedLabels, setSelectedLabels] = React.useState<Record<string, string>>({})
  const { merchant_id, environment_id } = context
  React.useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true); setError("")
      const response = await apiFetch<ApiListResponse<Resource>>(`/api/v1/${kind}`, { token, signal: controller.signal, params: { merchant_id, environment_id, search: query || undefined, page, per_page: 20 } })
      if (controller.signal.aborted) return
      setLoading(false)
      if (isApiErrorResponse(response)) { setError(response.message); return }
      setOptions(current => page === 1 ? response.data : [...current, ...response.data.filter(item => !current.some(existing => (existing.shipment_id || existing.driver_id || existing.vehicle_id) === (item.shipment_id || item.driver_id || item.vehicle_id)))])
      setLastPage(Number(response.meta?.last_page ?? 1))
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [kind, token, merchant_id, environment_id, query, page, attempt])
  const ids = Array.isArray(selected) ? selected : selected ? [selected] : []
  return <div className="space-y-2 rounded-lg border p-3">
    <Input aria-label={`Search ${label}`} placeholder={`Search ${label}…`} value={query} onChange={event => { setQuery(event.target.value); setPage(1); setOptions([]) }} />
    {ids.map(id => <Button key={id} type="button" variant="secondary" className="h-auto min-h-11 whitespace-normal" onClick={() => onSelect(multiple ? id : "")}>{selectedLabels[id] || `Selected ${label}`} ×</Button>)}
    <div className="max-h-48 space-y-1 overflow-y-auto">{options.filter(item => kind !== "shipments" || ((item.environment_id ?? "") === (environment_id ?? "") && eligibleManualShipment({ ...item, status: item.status ?? "" }))).map(item => { const id = item.driver_id || item.vehicle_id || item.shipment_id || ""; const name = item.name || item.plate_number || item.ref_code || item.merchant_order_ref || id; return <button type="button" key={id} aria-pressed={ids.includes(id)} className={`block min-h-11 w-full rounded-md p-2 text-left text-sm ${ids.includes(id) ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} onClick={() => { setSelectedLabels(current => ({ ...current, [id]: name })); onSelect(id) }}>{name}</button> })}</div>
    {loading && <p role="status" className="text-sm">Loading…</p>}{!loading && !options.length && !error && <p className="text-sm text-muted-foreground">No matches found.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error} <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry</Button></p>}
    {page < lastPage && <Button variant="outline" disabled={loading} onClick={() => setPage(value => value + 1)}>Load more</Button>}
  </div>
}
