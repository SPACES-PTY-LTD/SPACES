"use client"

import * as React from "react"
import { AlertTriangle, Loader2, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LocationDialog } from "@/components/locations/location-dialog"
import { LocationDetailsDrawer } from "@/components/locations/location-details-drawer"
import { isApiErrorResponse } from "@/lib/api/client"
import { analyzeRun, getRunAnalysis, prefillAnalysisLocation, type RunAnalysisState } from "@/lib/api/run-analysis"
import type { Location } from "@/lib/types"

export function RunAnalysisCard({ runId, token, merchantId, environmentId }: { runId: string; token: string; merchantId?: string | null; environmentId?: string | null }) {
  const [state, setState] = React.useState<RunAnalysisState | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [preparing, setPreparing] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<{ id: string; values: Partial<Location> } | null>(null)
  const [matches, setMatches] = React.useState<Record<string, string>>({})
  const [locationChanged, setLocationChanged] = React.useState(false)
  const status = React.useRef<string | undefined>(undefined)
  const submitLock = React.useRef(false)
  const refresh = React.useRef<() => Promise<void>>(async () => {})
  const generation = React.useRef(0)
  const requestKey = React.useRef<string | null>(null)

  React.useEffect(() => {
    let active = true, reading = false
    const version = ++generation.current
    const generationRef = generation
    const controller = new AbortController()
    const load = async () => {
      if (!active || reading || document.visibilityState === "hidden") return
      reading = true
      try {
        const response = await getRunAnalysis(runId, token, merchantId, controller.signal)
        if (!active || generation.current !== version) return
        if (isApiErrorResponse(response)) { setError(response.message); return }
        setState(response.data); status.current = response.data.latest?.status; setError(null)
      } catch { if (active) setError("Could not load run analysis. Try again.") }
      finally { reading = false }
    }
    refresh.current = load
    void load()
    const timer = window.setInterval(() => { if (["queued", "processing"].includes(status.current ?? "")) void load() }, 5000)
    const visible = () => { if (document.visibilityState === "visible") void load() }
    document.addEventListener("visibilitychange", visible)
    return () => { active = false; generationRef.current++; controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible) }
  }, [runId, token, merchantId])

  const saved = state?.saved
  const report = saved?.report
  const pending = submitting || ["queued", "processing"].includes(state?.latest?.status ?? "")
  const stale = state?.stale || locationChanged
  const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: saved?.timezone || "UTC" }).format(new Date(value)) : "Time unavailable"

  async function start() {
    if (submitLock.current || pending || !state?.can_analyze) return
    submitLock.current = true; setSubmitting(true); setError(null)
    const version = generation.current
    requestKey.current ??= crypto.randomUUID()
    try {
      const response = await analyzeRun(runId, token, requestKey.current, merchantId)
      if (version !== generation.current) return
      if (isApiErrorResponse(response)) { setError(response.message); return }
      requestKey.current = null; status.current = response.data.status
      setState(old => old && { ...old, latest: response.data })
      setLocationChanged(false)
      await refresh.current()
    } catch { if (version === generation.current) setError("Could not start analysis. Try again.") }
    finally { if (version === generation.current) setSubmitting(false); submitLock.current = false }
  }

  async function prepare(candidateId: string) {
    if (!saved || preparing) return
    setPreparing(candidateId); setError(null)
    const version = generation.current
    try {
      const response = await prefillAnalysisLocation(runId, saved.analysis_id, candidateId, token, merchantId)
      if (version !== generation.current) return
      if (isApiErrorResponse(response)) { setError(response.message); return }
      if (response.data.existing_location_id) setMatches(old => ({ ...old, [candidateId]: response.data.existing_location_id! }))
      else if (response.data.initial_values) setDraft({ id: candidateId, values: response.data.initial_values })
    } catch { if (version === generation.current) setError("Could not prepare location. Try again.") }
    finally { if (version === generation.current) setPreparing(null) }
  }

  return <Card>
    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
      <CardTitle className="flex items-center gap-2"><Sparkles className="size-5" />AI run analysis</CardTitle>
      {report && state?.can_analyze && <Button variant="outline" size="sm" disabled={pending || !state.configured} onClick={() => void start()}>Re-analyze run</Button>}
    </CardHeader>
    <CardContent className="space-y-4">
      {!state && !error && <p role="status" className="text-sm text-muted-foreground">Loading saved analysis…</p>}
      {state && !state.configured && <p className="text-sm text-muted-foreground">AI analysis is not configured. Contact your administrator.</p>}
      {pending && <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
        <Loader2 className="size-5 animate-spin text-primary motion-reduce:animate-none" />
        <div><p className="text-sm font-medium">Analyzing run data…</p><p className="text-xs text-muted-foreground">Checking stops, timings and automation. You can leave this page; the report will be saved automatically.</p></div>
      </div>}
      {(error || state?.latest?.status === "failed") && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive"><span>{error || state?.latest?.error || "Analysis failed. Try again."}</span><Button variant="outline" size="sm" disabled={pending} onClick={() => { if (state?.latest?.status === "failed" && state.can_analyze) { requestKey.current = null; void start() } else void refresh.current() }}>Retry</Button></div>}
      {!report && state && !pending && <div className="space-y-3"><p className="text-sm text-muted-foreground">Check why this run took too long or ended early, and identify location and automation red flags.</p>{state.can_analyze ? <Button disabled={!state.configured} onClick={() => void start()}><Sparkles className="size-4" />Analyze using AI</Button> : <p className="text-sm text-muted-foreground">You have view-only access to saved reports.</p>}</div>}
      {report && saved && <>
        <p className="text-xs text-muted-foreground">Saved {date(saved.completed_at)} · Data as of {date(saved.as_of)} ({saved.timezone})</p>
        {stale && <p role="status" className="text-sm text-amber-700 dark:text-amber-400">Run evidence, locations or automation settings have changed. Re-analyze for an updated report.</p>}
        <p className="text-sm font-medium">{report.conclusion}</p>
        <dl className="grid gap-3 rounded-lg bg-muted/30 p-3 text-sm sm:grid-cols-2"><div><dt className="font-medium">Expected ending</dt><dd className="mt-1 text-muted-foreground">{report.expected_ending}</dd></div><div><dt className="font-medium">Observed ending</dt><dd className="mt-1 text-muted-foreground">{report.observed_ending}</dd></div></dl>
        <div className="space-y-3"><h3 className="text-sm font-semibold">Red flags</h3>{report.red_flags.length === 0 && <p className="text-sm text-muted-foreground">No red flags identified from the available evidence.</p>}
          {report.red_flags.map((flag, index) => <div key={index} className="space-y-2 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2"><AlertTriangle className="size-4 text-amber-600" /><span className="font-semibold">{flag.title}</span><Badge variant="outline">{flag.severity}</Badge><Badge variant="outline">{flag.certainty.replaceAll("_", " ")}</Badge></div>
            <p>{flag.finding}</p><p><span className="font-medium">Action: </span>{flag.action}</p>
            <details><summary className="cursor-pointer text-muted-foreground">Evidence and rule details</summary><div className="mt-2 space-y-2 text-muted-foreground"><p className="whitespace-pre-wrap">{flag.details}</p>{saved.evidence.filter(item => flag.evidence_ids.includes(item.evidence_id)).map(item => <p key={item.evidence_id}>{date(item.at)} · {item.event.replaceAll("_", " ")}{item.location ? ` · ${item.location}` : ""}{item.duration_seconds !== null ? ` · ${Math.round(item.duration_seconds / 60)} minutes at location` : ""}{item.expected_waiting_minutes !== null ? ` · expected ${item.expected_waiting_minutes} minutes` : ""}</p>)}</div></details>
          </div>)}
        </div>
        {report.missing_locations.map(item => <div key={item.candidate_id} className="space-y-2 rounded-lg border p-3 text-sm"><h3 className="font-semibold">Suggested location: {item.provider_name ?? item.provider_address ?? item.suggested_name}</h3>
          {item.provider_name && item.provider_address && <p>{item.provider_address}</p>}
          {item.description_source ? <p className="text-xs text-muted-foreground">{item.description_source} · Review before creating</p> : <p className="text-xs text-muted-foreground">No name or address available from the recorded tracking position.</p>}
          {item.latitude != null && item.longitude != null && <p className="text-xs text-muted-foreground">Coordinates: {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}</p>}
          <p>{item.reason}</p>
          {matches[item.candidate_id] ? <LocationDetailsDrawer locationId={matches[item.candidate_id]} label="View saved location" accessToken={token} merchantId={merchantId} /> : state?.can_create_location && <Button variant="outline" size="sm" disabled={!!preparing} onClick={() => void prepare(item.candidate_id)}>{preparing === item.candidate_id ? "Preparing…" : "Create location"}</Button>}
          <p className="text-xs text-muted-foreground">Review the location form and geofence before pressing Create. This recommendation does not create a location or change automation.</p>
        </div>)}
        {report.limitations.length > 0 && <details><summary className="cursor-pointer text-sm text-muted-foreground">Evidence limitations</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{report.limitations.map((limit, index) => <li key={index}>{limit}</li>)}</ul></details>}
      </>}
      {draft && <LocationDialog key={draft.id} open onOpenChange={open => { if (!open) setDraft(null) }} initialValues={draft.values} initializeFallbackTypes={false} lockMerchant merchantId={merchantId} environmentId={environmentId ?? null} accessToken={token} trigger={<span />} onSaved={location => { setMatches(old => ({ ...old, [draft.id]: location.location_id })); setDraft(null); setLocationChanged(true); void refresh.current() }} />}
    </CardContent>
  </Card>
}
