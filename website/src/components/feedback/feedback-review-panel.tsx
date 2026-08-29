"use client"

import * as React from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ArrowLeft, Loader2, Send, UserCheck, UserMinus } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "@/components/common/status-badge"
import { isApiErrorResponse } from "@/lib/api/client"
import { markAdminFeedbackRead, replyToAdminFeedback, updateAdminFeedback } from "@/lib/api/feedback"
import { AdminLinks } from "@/lib/routes/admin"
import type { Feedback, FeedbackStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS: Array<{ value: FeedbackStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "needs_info", label: "Needs info" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
]

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = parseISO(value)
  return Number.isNaN(date.getTime()) ? value : format(date, "MMM d, yyyy HH:mm")
}

export function FeedbackReviewPanel({
  feedback: initialFeedback,
  accessToken,
  currentUserId,
}: {
  feedback: Feedback
  accessToken: string
  currentUserId: string | null
}) {
  const [feedback, setFeedback] = React.useState(initialFeedback)
  const [message, setMessage] = React.useState("")
  const [replyStatus, setReplyStatus] = React.useState<FeedbackStatus | "unchanged">("unchanged")
  const [saving, setSaving] = React.useState(false)
  const isAssignedToMe = Boolean(currentUserId && feedback.assignee?.user_id === currentUserId)

  React.useEffect(() => {
    void markAdminFeedbackRead(feedback.feedback_id, accessToken)
  }, [accessToken, feedback.feedback_id])

  async function update(payload: { status?: FeedbackStatus; assignment?: "self" | "unassigned" }) {
    setSaving(true)
    const response = await updateAdminFeedback(feedback.feedback_id, payload, accessToken)
    setSaving(false)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Unable to update feedback.")
      return
    }
    setFeedback(response.data)
    toast.success("Feedback updated.")
  }

  async function handleStatus(value: FeedbackStatus) {
    if (value === "needs_info") {
      setReplyStatus("needs_info")
      toast.info("Write a public reply explaining what information is needed.")
      document.getElementById("reviewer-feedback-reply")?.focus()
      return
    }
    await update({ status: value })
  }

  async function handleReply(event: React.FormEvent) {
    event.preventDefault()
    if (!message.trim()) return
    setSaving(true)
    const response = await replyToAdminFeedback(
      feedback.feedback_id,
      { message: message.trim(), status: replyStatus === "unchanged" ? undefined : replyStatus },
      accessToken
    )
    setSaving(false)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Unable to send reply.")
      return
    }
    setMessage("")
    setReplyStatus("unchanged")
    setFeedback(response.data)
    toast.success("Reply sent.")
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" asChild className="-ml-3">
        <Link href={AdminLinks.feedback}><ArrowLeft /> Back to feedback</Link>
      </Button>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">{feedback.category.replace(/_/g, " ")}</Badge>
              <StatusBadge status={feedback.status} />
              {feedback.unread ? <Badge variant="destructive">Unread</Badge> : null}
            </div>
            <CardTitle className="text-base">Conversation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="max-h-[55vh] space-y-4 overflow-y-auto rounded-lg border bg-muted/20 p-4">
              {(feedback.messages ?? []).map((item) => (
                <div key={item.message_id} className={cn("flex", item.author_type === "reviewer" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                    item.author_type === "reviewer" ? "bg-black text-white" : "border bg-background"
                  )}>
                    <p className="mb-1 text-xs font-medium opacity-70">{item.sender?.name ?? "Deleted user"}</p>
                    <p className="whitespace-pre-wrap break-words">{item.body}</p>
                    <p className="mt-2 text-[10px] opacity-60">{formatDate(item.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleReply} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="reviewer-feedback-reply">Public reply</Label>
                <Textarea
                  id="reviewer-feedback-reply"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={5000}
                  className="min-h-28"
                  placeholder="Write a reply that the submitter can read…"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-full space-y-2 sm:w-56">
                  <Label>Set status with reply</Label>
                  <Select value={replyStatus} onValueChange={(value) => setReplyStatus(value as FeedbackStatus | "unchanged")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unchanged">Keep current status</SelectItem>
                      {STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={saving || !message.trim()}>
                  {saving ? <Loader2 className="animate-spin" /> : <Send />}
                  Send reply
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Workflow</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={feedback.status} onValueChange={(value) => void handleStatus(value as FeedbackStatus)} disabled={saving}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assignment</Label>
                <p className="text-sm text-muted-foreground">{feedback.assignee?.name ?? "Unassigned"}</p>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={saving}
                  onClick={() => void update({ assignment: isAssignedToMe ? "unassigned" : "self" })}
                >
                  {isAssignedToMe ? <UserMinus /> : <UserCheck />}
                  {isAssignedToMe ? "Unassign" : "Assign to me"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Submission details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Sent by</p><p className="font-medium">{feedback.submitter?.name ?? "Deleted user"}</p><p>{feedback.submitter?.email}</p></div>
              <div><p className="text-xs text-muted-foreground">Merchant</p><p>{feedback.merchant?.name ?? "Platform feedback"}</p></div>
              <div><p className="text-xs text-muted-foreground">Page</p><p className="break-all font-mono text-xs">{feedback.page_path}</p></div>
              <div><p className="text-xs text-muted-foreground">Submitted</p><p>{formatDate(feedback.created_at)}</p></div>
              <div><p className="text-xs text-muted-foreground">Last updated</p><p>{formatDate(feedback.updated_at)}</p></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
