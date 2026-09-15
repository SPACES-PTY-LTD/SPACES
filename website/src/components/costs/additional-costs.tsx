"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import { listLocations } from "@/lib/api/locations"
import { costTotalsLabel, costCurrencies } from "@/lib/costs"
import type { AdditionalCost, AdditionalCostSummary, ApiEnvelope, CostTotal, Location } from "@/lib/types"

type Props = {
  kind: "runs" | "locations"
  id: string
  accessToken?: string
  merchantId?: string | null
  environmentId?: string | null
  onChanged?: (summary: AdditionalCostSummary) => void
}
type Draft = { title: string; amount: string }

export function AdditionalCostsDialog(props: Props & { totals?: CostTotal[]; compact?: boolean }) {
  const [totals, setTotals] = React.useState(props.totals)
  React.useEffect(() => setTotals(props.totals), [props.totals])
  return <Dialog>
    <DialogTrigger asChild><Button variant="outline" size="sm" aria-label={`Additional costs: ${costTotalsLabel(totals)}`} onClick={(event) => event.stopPropagation()}>{props.compact ? "" : "Additional costs · "}{costTotalsLabel(totals)}</Button></DialogTrigger>
    <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
      <DialogHeader><DialogTitle>Geofence additional costs</DialogTitle><DialogDescription>These costs are applied to a run each time its vehicle enters this geofence.</DialogDescription></DialogHeader>
      <AdditionalCosts {...props} onChanged={(summary) => { setTotals(summary.additional_cost_totals); props.onChanged?.(summary) }} />
    </DialogContent>
  </Dialog>
}

export function AdditionalCosts({ kind, id, accessToken, merchantId, environmentId, onChanged }: Props) {
  const router = useRouter()
  const base = `/api/v1/${kind}/${id}/additional-costs`
  const [summary, setSummary] = React.useState<AdditionalCostSummary | null>(null)
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [editing, setEditing] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<Draft>({ title: "", amount: "" })
  const [adding, setAdding] = React.useState(false)
  const [source, setSource] = React.useState("manual")
  const [search, setSearch] = React.useState("")
  const [locations, setLocations] = React.useState<Location[]>([])
  const [locationId, setLocationId] = React.useState("")
  const [configured, setConfigured] = React.useState<AdditionalCost[]>([])
  const [selected, setSelected] = React.useState<Record<string, Draft>>({})
  const [locationPage, setLocationPage] = React.useState(1)
  const [moreLocations, setMoreLocations] = React.useState(false)
  const [loadingLocations, setLoadingLocations] = React.useState(false)
  const [loadingCosts, setLoadingCosts] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    setSummary(null)
    apiFetch<ApiEnvelope<AdditionalCostSummary>>(base, { token: accessToken }).then((response) => {
      if (!alive) return
      if (isApiErrorResponse(response)) setError(response.message)
      else { setSummary(response.data); setError("") }
    }).catch(() => { if (alive) setError("Could not load costs. Please reopen this page.") })
    return () => { alive = false }
  }, [base, accessToken])

  React.useEffect(() => {
    if (!adding || source !== "geofence" || kind !== "runs") return
    let alive = true
    setLoadingLocations(true)
    const timer = setTimeout(async () => {
      try {
        const result = await listLocations(accessToken, { merchant_id: merchantId ?? undefined, environment_id: environmentId ?? "", search: search || undefined, per_page: 50, page: locationPage })
        if (!alive) return
        if (isApiErrorResponse(result)) setError(result.message)
        else {
          // The server validates environment ownership again when attaching a cost.
          setLocations((previous) => locationPage === 1 ? result.data : [...previous, ...result.data])
          setMoreLocations((result.meta?.last_page ?? 1) > locationPage)
        }
      } catch { if (alive) setError("Could not load geofences.") }
      finally { if (alive) setLoadingLocations(false) }
    }, 250)
    return () => { alive = false; clearTimeout(timer) }
  }, [adding, source, kind, accessToken, merchantId, environmentId, search, locationPage])

  React.useEffect(() => {
    setConfigured([]); setSelected({})
    if (!locationId) return
    let alive = true
    setLoadingCosts(true)
    apiFetch<ApiEnvelope<AdditionalCostSummary>>(`/api/v1/locations/${locationId}/additional-costs`, { token: accessToken }).then((result) => {
      if (!alive) return
      if (isApiErrorResponse(result)) setError(result.message)
      else setConfigured(result.data.additional_costs)
    }).catch(() => { if (alive) setError("Could not load geofence costs.") }).finally(() => { if (alive) setLoadingCosts(false) })
    return () => { alive = false }
  }, [locationId, accessToken])

  async function mutate(method: "POST" | "PATCH" | "DELETE", body?: unknown, costId?: string) {
    const result = await apiFetch<ApiEnvelope<AdditionalCostSummary>>(base + (costId ? `/${costId}` : ""), { method, body, token: accessToken })
    if (isApiErrorResponse(result)) throw new Error(result.message)
    setSummary(result.data)
    onChanged?.(result.data)
    router.refresh()
  }

  async function save() {
    setBusy(true); setError("")
    try {
      if (editing) {
        await mutate("PATCH", draft, editing)
        setEditing(null)
      } else if (kind === "runs" && source === "geofence") {
        for (const [costId, values] of Object.entries(selected)) {
          await mutate("POST", { ...values, source: "geofence", location_cost_id: costId })
          // Keep only unsaved selections if a later request fails.
          setSelected((current) => { const next = { ...current }; delete next[costId]; return next })
        }
        setAdding(false)
      } else {
        await mutate("POST", { ...draft, ...(kind === "runs" ? { source: "manual" } : {}) })
        setDraft({ title: "", amount: "" }); setAdding(false)
      }
      toast.success("Additional costs saved.")
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save costs.") }
    finally { setBusy(false) }
  }

  async function remove(costId: string) {
    setBusy(true); setError("")
    try { await mutate("DELETE", undefined, costId); toast.success("Cost removed.") }
    catch (e) { setError(e instanceof Error ? e.message : "Could not remove cost.") }
    finally { setBusy(false) }
  }

  const editCost = summary?.additional_costs.find((cost) => cost.cost_id === editing)
  const currency = editCost?.currency ?? summary?.default_currency ?? "ZAR"
  const showFields = editing || (adding && (kind === "locations" || source === "manual"))

  return <section className="space-y-4" aria-label="Additional costs">
    {error && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
    {!summary && !error && <p className="text-sm text-muted-foreground">Loading costs…</p>}
    {summary && <>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Additional costs</h2><p className="text-sm text-muted-foreground">{costTotalsLabel(summary.additional_cost_totals)}</p></div>
        {summary.can_edit && !adding && !editing && <Button size="sm" onClick={() => { setDraft({ title: "", amount: "" }); setAdding(true); setError("") }}>Add cost</Button>}
      </div>
      <div className="space-y-2">
        {summary.additional_costs.map((cost) => <div key={cost.cost_id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
          <div className="min-w-0 flex-1"><div className="break-words font-medium">{cost.title}</div>
            {kind === "runs" && <p className="text-xs text-muted-foreground">{cost.source === "manual" ? "Manual" : `Geofence${cost.location_name ? ` · ${cost.location_name}` : ""}`}{cost.visited_at ? ` · ${new Date(cost.visited_at).toLocaleString("en-ZA")}` : ""}</p>}
          </div>
          <span className="text-sm tabular-nums">{cost.currency} {cost.amount}</span>
          <div className="flex gap-1">
            {summary.can_edit && <Button variant="ghost" size="sm" disabled={busy || adding} onClick={() => { setEditing(cost.cost_id); setDraft({ title: cost.title, amount: cost.amount }) }} aria-label={`Edit ${cost.title}`}>Edit</Button>}
            {summary.can_delete && <Button variant="ghost" size="sm" disabled={busy || !!editing || adding} onClick={() => void remove(cost.cost_id)} aria-label={`Remove ${cost.title}`}>Remove</Button>}
          </div>
        </div>)}
        {!summary.additional_costs.length && <p className="text-sm text-muted-foreground">No additional costs yet.</p>}
      </div>
      {(adding || editing) && <form className="space-y-3 rounded-md border bg-muted/20 p-3" onSubmit={(event) => { event.preventDefault(); void save() }}>
        <fieldset disabled={busy} className="space-y-3">
          {adding && kind === "runs" && <Select value={source} onValueChange={setSource}><SelectTrigger aria-label="Cost source"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="geofence">Geofence</SelectItem></SelectContent></Select>}
          {showFields && <CostFields value={draft} currency={currency} onChange={setDraft} />}
          {adding && kind === "runs" && source === "geofence" && <>
            <Input aria-label="Search geofences" placeholder="Search geofences" value={search} onChange={(e) => { setSearch(e.target.value); setLocationPage(1) }} />
            <Select value={locationId} onValueChange={setLocationId}><SelectTrigger aria-label="Geofence"><SelectValue placeholder="Select a geofence" /></SelectTrigger><SelectContent>{locations.map((location) => <SelectItem key={location.location_id} value={location.location_id}>{location.name || location.company || location.location_id}</SelectItem>)}</SelectContent></Select>
            {loadingLocations && <p className="text-xs text-muted-foreground">Loading geofences…</p>}
            {moreLocations && <Button type="button" variant="outline" disabled={loadingLocations} onClick={() => setLocationPage((page) => page + 1)}>Load more geofences</Button>}
            {loadingCosts && <p className="text-sm text-muted-foreground">Loading configured costs…</p>}
            {configured.map((cost) => <div className="space-y-2 rounded border p-2" key={cost.cost_id}>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!selected[cost.cost_id]} onChange={(e) => setSelected((current) => { const next = { ...current }; if (e.target.checked) next[cost.cost_id] = { title: cost.title, amount: cost.amount }; else delete next[cost.cost_id]; return next })} />{cost.title} · {cost.currency} {cost.amount}</label>
              {selected[cost.cost_id] && <CostFields value={selected[cost.cost_id]} currency={cost.currency} onChange={(value) => setSelected((current) => ({ ...current, [cost.cost_id]: value }))} />}
            </div>)}
            {locationId && !configured.length && !loadingCosts && <p className="text-sm text-muted-foreground">This geofence has no configured costs.</p>}
          </>}
          <div className="flex gap-2"><Button type="submit" disabled={busy || (adding && kind === "runs" && source === "geofence" && !Object.keys(selected).length)}>{busy ? "Saving…" : "Save costs"}</Button><Button type="button" variant="outline" onClick={() => { setAdding(false); setEditing(null) }}>Cancel</Button></div>
        </fieldset>
      </form>}
    </>}
  </section>
}

function CostFields({ value, currency, onChange }: { value: Draft; currency: string; onChange: (value: Draft) => void }) {
  const precision = costCurrencies[currency as keyof typeof costCurrencies] ?? 2
  return <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
    <label className="space-y-1 text-sm">Title<Input required maxLength={255} value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} /></label>
    <label className="space-y-1 text-sm">Price ({currency})<Input required type="number" min="0" max="9999999999.999" step={precision ? `0.${"0".repeat(precision - 1)}1` : "1"} value={value.amount} onChange={(e) => onChange({ ...value, amount: e.target.value })} /></label>
  </div>
}
