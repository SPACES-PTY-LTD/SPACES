"use client"

import * as React from "react"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/page-header"
import { purgeMerchantData, getPurgeStatus, purgeDataTypes, type PurgeJobStatus, type PurgeDataType } from "@/lib/api/delete-data"
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
import { Separator } from "@/components/ui/separator"
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
  const [job, setJob] = React.useState<PurgeJobStatus | null>(null)
  const [monitoringError, setMonitoringError] = React.useState<string | null>(null)
  const [checkingStatus, setCheckingStatus] = React.useState(true)
  const requestInFlight = React.useRef(false)
  const requestVersion = React.useRef(0)
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
          }
          setCheckingStatus(false)
        }
      } catch {
        if (!controller.signal.aborted) setMonitoringError("Unable to check deletion status. Reconnecting…")
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 3000)
      }
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [merchantId, accessToken])

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
    }
  }

  return (
    <div className="space-y-6 flex-1">
      <PageHeader
        title="Permanent data deletion"
        description="Delete selected merchant data in bulk. This action is destructive and requires your password."
      />

      <div aria-live="polite" className="space-y-2">
        {checkingStatus && merchantId ? <p>Checking previous deletion status…</p> : null}
        {monitoringError ? <p className="text-destructive" role="alert">{monitoringError} Deletion may still be running.</p> : null}
        {job ? (
          <Card>
            <CardHeader>
              <CardTitle>Deletion {job.status}</CardTitle>
              <CardDescription>Request {job.job_id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>{job.requested_types.map(formatTypeLabel).join(", ")}</p>
              {job.status === "queued" ? <p>Waiting for a background worker. You can leave this page and return later. If this stays queued, ask your administrator to check the queue worker.</p> : null}
              {job.status === "running" ? <p>Deleting the selected data. This may take several minutes. You can leave this page and return later.</p> : null}
              {job.status === "completed" ? <p>Database deletion completed. Uploaded-file cleanup runs separately and may still be in progress.</p> : null}
              {job.error_message ? <p className="text-destructive" role="alert">{job.error_message}</p> : null}
              <p className="text-sm text-muted-foreground">Requested: {new Date(job.created_at).toLocaleString()}</p>
              {job.started_at ? <p className="text-sm text-muted-foreground">Started: {new Date(job.started_at).toLocaleString()}</p> : null}
              {job.finished_at ? <p className="text-sm text-muted-foreground">Finished: {new Date(job.finished_at).toLocaleString()}</p> : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardDescription>
            Choose the data sets to purge for the selected merchant, then confirm with your password. Vehicle activity includes GPS history. Deleting shipments also removes delivery-note imports, including unconfirmed uploads. Associated uploaded files are queued for permanent removal after database deletion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Deleted records cannot be recovered from this screen. Review the selected types carefully before you continue.
          </div>

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

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Deletion results</CardTitle>
            <CardDescription>
              Merchant <span className="font-mono text-xs">{result.merchant_uuid}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {result.requested_types.map((type) => (
                <Badge key={`requested-${type}`} variant="outline">
                  {formatTypeLabel(type)}
                </Badge>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="text-sm font-medium">Requested types</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {result.requested_types.join(", ") || "None"}
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm font-medium">Processed types</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {result.processed_types.join(", ") || "None"}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              {Object.entries(result.results).map(([type, details]) => (
                <div key={type} className="rounded-lg border">
                  <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                    <div className="font-medium">{formatTypeLabel(type)}</div>
                    <Badge variant="secondary">
                      {details.deleted_rows ?? 0} rows deleted
                    </Badge>
                  </div>
                  <div className="p-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Table</TableHead>
                          <TableHead className="text-right">Deleted rows</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(details.tables ?? {}).map(([tableName, count]) => (
                          <TableRow key={tableName}>
                            <TableCell className="font-mono text-xs">{tableName}</TableCell>
                            <TableCell className="text-right">{count}</TableCell>
                          </TableRow>
                        ))}
                        {Object.keys(details.tables ?? {}).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-sm text-muted-foreground">
                              No table-level details returned.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
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
