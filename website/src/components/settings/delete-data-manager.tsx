"use client"

import * as React from "react"
import { CheckCircle2, Circle, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/page-header"
import { purgeMerchantData, getPurgeStatus, cancelPurge, purgeDataTypes, type PurgeJobStatus, type PurgeDataType } from "@/lib/api/delete-data"
import { isApiErrorResponse } from "@/lib/api/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const labels: Record<PurgeDataType, string> = {
  shipments: "Shipments",
  runs: "Runs",
  vehicle_activity: "Vehicle activity",
  routes: "Routes",
  drivers: "Drivers",
  vehicles: "Vehicles",
  locations: "Locations",
  location_types: "Location types",
  api_call_logs: "API call logs",
  idempotency_keys: "Idempotency keys",
  activity_logs: "Activity logs",
}

function formatTypeLabel(value: string) {
  if (value in labels) {
    return labels[value as PurgeDataType]
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function MerchantDeleteDataManager({
  accessToken,
  merchantId,
}: {
  accessToken?: string
  merchantId?: string | null
}) {
  const [selectedTypes, setSelectedTypes] = React.useState<PurgeDataType[]>([])
  const [password, setPassword] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [cancelling, setCancelling] = React.useState(false)
  const [job, setJob] = React.useState<PurgeJobStatus | null>(null)
  const [monitoringError, setMonitoringError] = React.useState<string | null>(null)
  const [checkingStatus, setCheckingStatus] = React.useState(true)
  const requestInFlight = React.useRef(false)
  const requestVersion = React.useRef(0)
  const [monitorVersion, setMonitorVersion] = React.useState(0)
  const result = job?.result ?? null
  const active = job?.status === "queued" || job?.status === "running"
  const busy = submitting || active || checkingStatus || Boolean(monitoringError)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const merchantMissing = !merchantId

  React.useEffect(() => {
    if (!merchantId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      const version = requestVersion.current
      let keepPolling = true
      try {
        const response = await getPurgeStatus(merchantId!, accessToken, controller.signal)
        if (controller.signal.aborted) return
        // Do not let a status request started before POST overwrite its response.
        if (!requestInFlight.current && version === requestVersion.current) {
          if (isApiErrorResponse(response)) {
            setMonitoringError("Unable to check deletion status. Reconnecting…")
          } else {
            setJob(response.data)
            setMonitoringError(null)
            keepPolling = response.data?.status === "queued" || response.data?.status === "running"
          }
          setCheckingStatus(false)
        }
      } catch {
        if (!controller.signal.aborted) setMonitoringError("Unable to check deletion status. Reconnecting…")
      } finally {
        if (!controller.signal.aborted && keepPolling) timer = setTimeout(poll, 5000)
      }
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [merchantId, accessToken, monitorVersion])

  function toggleType(type: PurgeDataType) {
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((value) => value !== type)
        : [...current, type]
    )
  }

  function validateForm() {
    if (!merchantId) {
      toast.error("Select a merchant before deleting data.")
      return false
    }

    if (selectedTypes.length === 0) {
      toast.error("Select at least one data type to delete.")
      return false
    }

    if (!password.trim()) {
      toast.error("Password is required.")
      return false
    }

    return true
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    setConfirmOpen(true)
  }

  async function cancelDeletion() {
    if (!merchantId || !job || !active || cancelling || job.cancel_requested) return
    requestVersion.current++
    requestInFlight.current = true
    setCancelling(true)
    try {
      const response = await cancelPurge(merchantId, job.job_id, accessToken)
      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Unable to request cancellation.")
      } else {
        setJob(response.data)
      }
    } catch {
      toast.error("Unable to confirm cancellation. Checking status…")
    } finally {
      requestInFlight.current = false
      setCancelling(false)
      setMonitorVersion((value) => value + 1)
    }
  }

  async function confirmDelete() {
    if (!merchantId || busy || !validateForm()) return
    requestVersion.current++
    requestInFlight.current = true
    setSubmitting(true)
    try {
      const response = await purgeMerchantData(merchantId, {
        merchant_id: merchantId,
        password,
        types: selectedTypes,
      }, accessToken)
      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Unable to queue deletion.")
        // A lost response may still have queued work. Recheck before allowing another request.
        setCheckingStatus(true)
        return
      }
      setJob(response.data)
      setConfirmOpen(false)
      setPassword("")
      setMonitoringError(null)
      toast.success("Deletion queued. You can leave this page and return to check its status.")
    } catch {
      toast.error("Unable to confirm deletion status. Checking the server…")
      setCheckingStatus(true)
    } finally {
      requestInFlight.current = false
      setSubmitting(false)
      setMonitorVersion((value) => value + 1)
    }
  }

  return (
    <div className="space-y-6 flex-1">
      <PageHeader
        title="Permanent data deletion"
        description="Delete selected merchant data in bulk. This action is destructive and requires your password."
      />


      <Card>
        <CardHeader>
          <CardDescription>
            Choose the data sets to purge for the selected merchant, then confirm with your password. Vehicle activity includes GPS history. Deleting shipments also removes delivery-note imports, including unconfirmed uploads. Associated uploaded files are queued for permanent removal after database deletion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <Label>Data types</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {purgeDataTypes.map((type) => {
                  const checked = selectedTypes.includes(type)

                  return (
                    <label
                      key={type}
                      className={[
                        "flex items-start gap-3 rounded-lg border p-4 text-sm transition-colors",
                        checked
                          ? "border-destructive bg-destructive/5"
                          : "border-border hover:bg-muted/30",
                        merchantMissing || busy ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={merchantMissing || busy}
                        onChange={() => toggleType(type)}
                        className="mt-0.5 h-4 w-4 rounded border-input text-destructive focus:ring-destructive"
                      />
                      <span className="font-medium">{labels[type]}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-data-password">Password</Label>
              <Input
                id="delete-data-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={merchantMissing || busy}
                placeholder="Enter your password"
              />
            </div>

            {merchantMissing ? (
              <div className="text-sm text-destructive">
                No merchant is selected. Choose a merchant first, then return to this page.
              </div>
            ) : null}

            <Button
              type="submit"
              variant="destructive"
              disabled={merchantMissing || busy}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete selected data
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm data deletion</DialogTitle>
            <DialogDescription>
              This will permanently delete the selected merchant data. Review the types below before continuing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-destructive">
              This action cannot be undone. Runs and vehicles include their GPS history. Uploaded attachments for deleted records will also be removed; file cleanup may finish in the background.
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Selected types</div>
              <div className="flex flex-wrap gap-2">
                {selectedTypes.map((type) => (
                  <Badge key={type} variant="outline">
                    {labels[type]}
                  </Badge>
                ))}
              </div>
            </div>

           
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={busy}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Confirm delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div aria-live="polite" className="space-y-2">
        {checkingStatus && merchantId ? <p>Checking previous deletion status…</p> : null}
        {monitoringError ? <p className="text-destructive" role="alert">{monitoringError} Deletion may still be running.</p> : null}
        {job ? (
          <Card className={job.status === "completed"
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
            : job.status === "cancelled"
              ? "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
            : job.status === "failed"
              ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
              : "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {active ? <Loader2 className="h-5 w-5 animate-spin text-blue-600 motion-reduce:animate-none" aria-hidden="true" /> : null}
                {job.cancel_requested ? "Cancellation requested" : `Deletion ${job.status}`}
              </CardTitle>
              <CardDescription>Request {job.job_id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul aria-label="Deletion checklist" className="grid gap-2 sm:grid-cols-2">
                {(job.progress?.ordered_types?.length ? job.progress.ordered_types : job.requested_types).map((type) => {
                  const done = job.result?.processed_types.includes(type)
                    ? true
                    : job.status === "running" && Boolean(job.progress?.processed_types?.includes(type))
                  const current = job.status === "running" && job.progress?.current_type === type
                  const state = done ? "Done" : current ? "Deleting…"
                    : job.status === "failed" || job.status === "cancelled" ? "Not completed"
                      : job.status === "running" && !job.progress?.ordered_types?.length ? "Awaiting progress" : "Waiting"
                  return (
                    <li key={type} className="flex items-center justify-between gap-3 rounded-md border border-current/10 bg-background/60 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        {done ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" />
                          : current ? <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-blue-600 motion-reduce:animate-none" />
                            : <Circle aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        {formatTypeLabel(type)}
                      </span>
                      <span className={done ? "font-medium text-emerald-700 dark:text-emerald-400" : current ? "font-medium text-blue-700 dark:text-blue-300" : "text-muted-foreground"}>{state}</span>
                    </li>
                  )
                })}
              </ul>
              {job.status === "running" ? <p className="text-xs text-muted-foreground">Done items are committed. Vehicle activity and GPS cleanup commit in batches; completed deletions cannot be undone.</p> : null}
              {job.status !== "failed" && job.status !== "cancelled" ? (
                <div className="space-y-2">
                  <div role="progressbar" aria-label="Deletion progress" aria-valuemin={0} aria-valuemax={100}
                    aria-valuenow={job.status === "completed" ? 100 : job.status === "queued" ? 0 : job.progress?.percent}
                    className="h-3 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900">
                    <div className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${job.status === "completed" ? "bg-emerald-600" : "bg-blue-600"} ${job.status === "running" && !job.progress ? "animate-pulse motion-reduce:animate-none" : ""}`}
                      style={{ width: `${job.status === "completed" ? 100 : job.status === "queued" ? 0 : job.progress?.percent ?? 25}%` }} />
                  </div>
                  <p className="text-sm font-medium">
                    {job.status === "completed" ? "100% — database deletion complete"
                      : job.status === "queued" ? "Waiting to start"
                        : job.progress ? `${job.progress.percent}% — ${job.progress.completed_types} of ${job.progress.total_types} data types processed`
                          : "Preparing deletion…"}
                  </p>
                  {job.status === "running" && job.progress ? <p className="text-sm">
                    {job.progress.current_type ? `Deleting ${formatTypeLabel(job.progress.current_type)}…` : "Finalizing deletion…"}
                    {" "}Progress is based on data types, not rows or time. Completed batches are permanent.
                  </p> : null}
                  {job.progress?.current_type_deleted_rows !== undefined ? <p className="text-xs text-muted-foreground">{job.progress.current_type_deleted_rows.toLocaleString()} rows deleted in this data type. Counts may reset if its transaction retries.</p> : null}
                  {active ? <p className="text-xs text-muted-foreground">Checking progress every 5 seconds.</p> : null}
                </div>
              ) : null}
              {job.status === "queued" ? <p>Waiting for a background worker. You can leave this page and return later. If this stays queued, ask your administrator to check the queue worker.</p> : null}
              {job.status === "running" ? <p>Deleting the selected data. This may take several minutes. You can leave this page and return later.</p> : null}
              {job.status === "completed" ? <p>Database deletion completed. Uploaded-file cleanup runs separately and may still be in progress.</p> : null}
              {job.status === "cancelled" ? <p>Deletion cancelled. Previously completed deletions remain permanent.</p> : null}
              {active ? (
                <div className="space-y-2">
                  <Button type="button" variant="outline" onClick={cancelDeletion} disabled={cancelling || job.cancel_requested}>
                    {cancelling ? "Requesting cancellation…" : job.cancel_requested ? "Cancellation requested" : "Cancel deletion"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {job.cancel_requested
                      ? "Waiting for the worker to stop at the next checkpoint. Completed batches cannot be undone."
                      : "Cancellation stops remaining work at the next safe checkpoint. Completed deletions and uploaded-file cleanup cannot be undone."}
                  </p>
                </div>
              ) : null}
              {job.error_message ? <p className="text-destructive" role="alert">{job.error_message}</p> : null}
              <p className="text-sm text-muted-foreground">Requested: {new Date(job.created_at).toLocaleString()}</p>
              {job.started_at ? <p className="text-sm text-muted-foreground">Started: {new Date(job.started_at).toLocaleString()}</p> : null}
              {job.finished_at ? <p className="text-sm text-muted-foreground">Finished: {new Date(job.finished_at).toLocaleString()}</p> : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Last Deletion results</CardTitle>
            <CardDescription>
              Merchant <span className="font-mono text-xs">{result.merchant_uuid}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Deleted rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(new Set([...result.requested_types, ...result.processed_types, ...Object.keys(result.results)])).map((type) => {
                  const processed = result.processed_types.includes(type)
                  const count = result.results[type]?.deleted_rows

                  return (
                    <TableRow key={type}>
                      <TableCell className="font-medium">{formatTypeLabel(type)}</TableCell>
                      <TableCell>{processed ? "Completed" : "Not completed"}</TableCell>
                      <TableCell className="text-right tabular-nums">{count == null ? "—" : count.toLocaleString()}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

// Remount when the merchant changes so requests and results cannot cross contexts.
export function DeleteDataManager(props: { accessToken?: string; merchantId?: string | null }) {
  return <MerchantDeleteDataManager key={props.merchantId ?? "none"} {...props} />
}
