"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
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
  return <Card><CardHeader><CardTitle>End run request · {entry.status}</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">Requested by {entry.requested_by || "Driver"} · {entry.requested_at}</p>
    <p className="whitespace-pre-wrap">{entry.reason}</p>
    {entry.status === "pending" && canReview ? <>
      <p>{unfinished} unfinished deliveries. Approval closes this run, including an empty run, without changing shipment statuses or reassigning deliveries.</p>
      <label className="flex items-start gap-2"><input type="checkbox" checked={confirm} disabled={busy} onChange={event => setConfirm(event.target.checked)} />I confirm closure even if deliveries remain unfinished.</label>
      <label className="block space-y-2"><span>Review reason (required to reject)</span><Textarea value={reason} maxLength={2000} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-3"><Button disabled={busy || !confirm} onClick={() => void decide("approved")}>{busy ? "Saving…" : "Approve"}</Button><Button variant="outline" disabled={busy || !reason.trim()} onClick={() => void decide("rejected")}>Reject</Button></div>
    </> : <p>{entry.review_reason || (entry.status === "pending" ? "Dispatch permission is required to review this request." : `Request ${entry.status}`)}{entry.reviewed_by ? ` · ${entry.reviewed_by}` : ""}</p>}
  </CardContent></Card>
}
