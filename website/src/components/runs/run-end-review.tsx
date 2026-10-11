"use client"
import { useRef, useState } from "react"
import { AlertTriangle, Check, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import type { ApiEnvelope, RunEndRequest } from "@/lib/types"

export function RunEndReview({ runId, request, accessToken, unfinished, canReview }: {
  runId: string; request: RunEndRequest; accessToken?: string; unfinished: number; canReview: boolean;
}) {
  const router = useRouter()
  const submitting = useRef(false)
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState("")
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState("")
  const [entry, setEntry] = useState(request)
  async function decide(decision: "approved" | "rejected") {
    if (submitting.current) return
    submitting.current = true; setBusy(true); setError("")
    try {
      const response = await apiFetch<ApiEnvelope<RunEndRequest>>(`/api/v1/runs/${runId}/end-requests/${entry.request_id}/review`, {
        token: accessToken, method: "POST", body: { decision, reason: reason.trim() || undefined, confirm_early_closure: confirm },
      })
      if (isApiErrorResponse(response)) { setError(response.message); router.refresh() }
      else { setEntry(response.data); router.refresh() }
    } catch { setError("Unable to review this request. Retry or refresh the run.") }
    finally { submitting.current = false; setBusy(false) }
  }
  const pending = entry.status === "pending"
  const requestedAt = new Date(entry.requested_at)
  const requestTime = Number.isNaN(requestedAt.getTime()) ? "Time unavailable"
    : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(requestedAt)

  return (
    <Card className={cn("overflow-hidden rounded-2xl", pending && "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100")}>
      <CardHeader className="gap-4 px-4 pb-5 sm:px-6">
        <div className="flex items-start gap-3">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted", pending && "bg-amber-200/60 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200")}>
            <AlertTriangle className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base leading-snug sm:text-lg">End run request</CardTitle>
              <span className={cn("rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize", pending && "bg-amber-200/70 text-amber-900 dark:bg-amber-900/70 dark:text-amber-100")}>
                {pending ? "Awaiting approval" : entry.status}
              </span>
            </div>
            <p className={cn("text-sm text-muted-foreground", pending && "text-amber-800 dark:text-amber-200/80")}>
              Requested by <span className="font-medium">{entry.requested_by || "Driver"}</span>
              <span className="mt-1 block sm:mt-0 sm:ml-2 sm:inline">{requestTime}</span>
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-4 sm:px-6">
        <div className={cn("space-y-2 rounded-xl border bg-background/70 p-4", pending && "border-amber-200/70 dark:border-amber-800/70")}>
          <p className={cn("text-xs font-semibold uppercase tracking-wide text-muted-foreground", pending && "text-amber-800 dark:text-amber-200")}>Driver’s reason</p>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{entry.reason}</p>
        </div>
        {pending && canReview ? <>
          <div className="space-y-2 text-sm leading-relaxed">
            <p className="font-semibold">{unfinished} unfinished {unfinished === 1 ? "delivery" : "deliveries"}</p>
            <p>Approval closes this run, including an empty run. Shipment statuses and delivery assignments stay unchanged.</p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-background/70 p-4 text-sm leading-relaxed dark:border-amber-800">
            <input type="checkbox" className="mt-1 size-4 shrink-0 accent-amber-700" checked={confirm} disabled={busy} onChange={event => setConfirm(event.target.checked)} />
            <span>I confirm closure even if deliveries remain unfinished.</span>
          </label>
          <label className="block space-y-2 text-sm">
            <span className="font-medium">Review reason <span className="font-normal">(required to reject)</span></span>
            <Textarea className="min-h-24 border-amber-200 bg-background dark:border-amber-800" placeholder="Explain your decision…" value={reason} maxLength={2000} disabled={busy} onChange={event => setReason(event.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-col gap-3 border-t border-amber-200 pt-4 sm:flex-row dark:border-amber-800">
            <Button disabled={busy || !confirm} onClick={() => void decide("approved")}><Check className="size-4" aria-hidden="true" />{busy ? "Saving…" : "Approve closure"}</Button>
            <Button className="bg-background" variant="outline" disabled={busy || !reason.trim()} onClick={() => void decide("rejected")}><X className="size-4" aria-hidden="true" />Reject request</Button>
          </div>
        </> : <p className="text-sm leading-relaxed">{entry.review_reason || (pending ? "Dispatch permission is required to review this request." : `Request ${entry.status}`)}{entry.reviewed_by ? ` · ${entry.reviewed_by}` : ""}</p>}
      </CardContent>
    </Card>
  )
}
