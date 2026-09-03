"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { ArrowLeft, Eye, Link2, Loader2, MessageSquareText, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "@/components/common/status-badge"
import {
  createFeedback,
  deleteMyFeedback,
  getAdminFeedbackUnreadCount,
  getMyFeedback,
  getMyFeedbackUnreadCount,
  listMyFeedback,
  markMyFeedbackRead,
  replyToMyFeedback,
  updateMyFeedback,
} from "@/lib/api/feedback"
import { isApiErrorResponse } from "@/lib/api/client"
import type { Feedback, FeedbackCategory } from "@/lib/types"
import { cn } from "@/lib/utils"

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Bug",
  feature_request: "Feature request",
  general: "General",
}

function formatDate(value?: string | null) {
  if (!value) return ""
  const date = parseISO(value)
  return Number.isNaN(date.getTime()) ? "" : format(date, "MMM d, yyyy HH:mm")
}

export function FeedbackWidget({
  accessToken,
  merchantId,
  canReviewFeedback,
  onReviewerUnreadChange,
}: {
  accessToken: string
  merchantId?: string | null
  canReviewFeedback: boolean
  onReviewerUnreadChange?: (count: number) => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const linkedFeedbackId = searchParams.get("feedback_id")
  const [open, setOpen] = React.useState(false)
  const [tab, setTab] = React.useState("send")
  const [category, setCategory] = React.useState<FeedbackCategory>("general")
  const [message, setMessage] = React.useState("")
  const [reply, setReply] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [loadingMine, setLoadingMine] = React.useState(false)
  const [loadingThread, setLoadingThread] = React.useState(false)
  const [threads, setThreads] = React.useState<Feedback[]>([])
  const [selectedThread, setSelectedThread] = React.useState<Feedback | null>(null)
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Feedback | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editingThread, setEditingThread] = React.useState<Feedback | null>(null)
  const [editCategory, setEditCategory] = React.useState<FeedbackCategory>("general")
  const [editMessage, setEditMessage] = React.useState("")
  const [loadingEditId, setLoadingEditId] = React.useState<string | null>(null)
  const [savingEdit, setSavingEdit] = React.useState(false)

  const refreshCounts = React.useCallback(async () => {
    const mine = await getMyFeedbackUnreadCount(accessToken)
    if (!isApiErrorResponse(mine)) {
      setUnreadCount(mine.data.count)
    }

    if (canReviewFeedback) {
      const reviewer = await getAdminFeedbackUnreadCount(accessToken)
      if (!isApiErrorResponse(reviewer)) {
        onReviewerUnreadChange?.(reviewer.data.count)
      }
    }
  }, [accessToken, canReviewFeedback, onReviewerUnreadChange])

  const loadThreads = React.useCallback(async () => {
    setLoadingMine(true)
    const response = await listMyFeedback(accessToken, { per_page: 50 })
    setLoadingMine(false)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Unable to load your feedback.")
      return
    }
    setThreads(response.data ?? [])
  }, [accessToken])

  const openThread = React.useCallback(async (feedbackId: string) => {
    setLoadingThread(true)
    const response = await getMyFeedback(feedbackId, accessToken)
    if (isApiErrorResponse(response)) {
      setLoadingThread(false)
      toast.error(response.message || "Unable to load feedback.")
      return
    }

    const readResponse = await markMyFeedbackRead(feedbackId, accessToken)
    const thread = isApiErrorResponse(readResponse) ? response.data : readResponse.data
    setSelectedThread(thread)
    setLoadingThread(false)
    await refreshCounts()
  }, [accessToken, refreshCounts])

  React.useEffect(() => {
    void refreshCounts()
    const handleFocus = () => void refreshCounts()
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [refreshCounts])

  React.useEffect(() => {
    if (!linkedFeedbackId) return
    setOpen(true)
    setTab("mine")
    void loadThreads()
    void openThread(linkedFeedbackId)
  }, [linkedFeedbackId, loadThreads, openThread])

  React.useEffect(() => {
    if (open && tab === "mine") {
      void loadThreads()
    }
    if (open) {
      void refreshCounts()
    }
  }, [loadThreads, open, refreshCounts, tab])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = message.trim()
    if (!trimmed) return
    setSubmitting(true)
    const response = await createFeedback(
      { merchant_id: merchantId, category, message: trimmed, page_path: pathname },
      accessToken
    )
    setSubmitting(false)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Unable to submit feedback.")
      return
    }

    setMessage("")
    setCategory("general")
    setTab("mine")
    setSelectedThread(response.data)
    toast.success("Thanks — your feedback was submitted.")
    await loadThreads()
    await refreshCounts()
  }

  async function handleReply(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedThread || !reply.trim()) return
    setSubmitting(true)
    const response = await replyToMyFeedback(selectedThread.feedback_id, reply.trim(), accessToken)
    setSubmitting(false)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Unable to send your reply.")
      return
    }
    setReply("")
    setSelectedThread(response.data)
    toast.success("Reply sent.")
    await loadThreads()
    await refreshCounts()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const response = await deleteMyFeedback(deleteTarget.feedback_id, accessToken)
    setDeleting(false)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Unable to delete feedback.")
      return
    }

    setDeleteConfirmOpen(false)
    if (selectedThread?.feedback_id === deleteTarget.feedback_id) {
      setSelectedThread(null)
    }
    setDeleteTarget(null)
    const nextSearchParams = new URLSearchParams(searchParams.toString())
    nextSearchParams.delete("feedback_id")
    const nextQuery = nextSearchParams.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname)
    toast.success("Feedback deleted.")
    await loadThreads()
    await refreshCounts()
  }

  async function beginEdit(thread: Feedback) {
    setLoadingEditId(thread.feedback_id)
    const response = await getMyFeedback(thread.feedback_id, accessToken)
    setLoadingEditId(null)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Unable to load feedback for editing.")
      return
    }

    const firstSubmitterMessage = response.data.messages?.find((item) => item.author_type === "submitter")
    if (!firstSubmitterMessage) {
      toast.error("Unable to find the original feedback message.")
      return
    }

    setEditingThread(response.data)
    setEditCategory(response.data.category)
    setEditMessage(firstSubmitterMessage.body)
    setEditOpen(true)
  }

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!editingThread || !editMessage.trim()) return

    setSavingEdit(true)
    const response = await updateMyFeedback(
      editingThread.feedback_id,
      { category: editCategory, message: editMessage.trim() },
      accessToken
    )
    setSavingEdit(false)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Unable to update feedback.")
      return
    }

    if (selectedThread?.feedback_id === editingThread.feedback_id) {
      setSelectedThread(response.data)
    }
    setEditOpen(false)
    setEditingThread(null)
    toast.success("Feedback updated.")
    await loadThreads()
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 h-12 rounded-full bg-black px-5 text-white shadow-xl hover:bg-black/85 md:right-6 md:bottom-6"
        aria-label="Give feedback"
      >
        <MessageSquareText className="size-4" />
        Give feedback
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-background">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSelectedThread(null)
      }}>
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-6 pt-6 pb-4">
            <DialogTitle>Feedback</DialogTitle>
            <DialogDescription>Share an idea or problem, and follow replies from the team.</DialogDescription>
          </DialogHeader>

          {selectedThread ? (
            <div className="flex min-h-0 flex-col px-6 pb-6">
              <div className="flex items-start justify-between gap-3 py-4">
                <div>
                  <Button variant="ghost" size="sm" className="-ml-3 mb-2" onClick={() => setSelectedThread(null)}>
                    <ArrowLeft className="size-4" /> Back to my feedback
                  </Button>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{CATEGORY_LABELS[selectedThread.category]}</Badge>
                    <StatusBadge status={selectedThread.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{selectedThread.page_path}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    setDeleteTarget(selectedThread)
                    setDeleteConfirmOpen(true)
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>

              {loadingThread ? (
                <div className="flex h-64 items-center justify-center"><Loader2 className="size-5 animate-spin" /></div>
              ) : (
                <ScrollArea className="h-[42vh] rounded-lg border bg-muted/20 p-4">
                  <div className="space-y-4 pr-3">
                    {(selectedThread.messages ?? []).map((item) => (
                      <div key={item.message_id} className={cn("flex", item.author_type === "submitter" ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                          item.author_type === "submitter" ? "bg-black text-white" : "border bg-background"
                        )}>
                          <p className="mb-1 text-xs font-medium opacity-70">{item.sender?.name ?? "User"}</p>
                          <p className="whitespace-pre-wrap break-words">{item.body}</p>
                          <p className="mt-2 text-[10px] opacity-60">{formatDate(item.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <form onSubmit={handleReply} className="mt-4 flex gap-2">
                <Textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  maxLength={5000}
                  placeholder={selectedThread.status === "closed" ? "Reply to reopen this feedback…" : "Write a reply…"}
                  className="min-h-20"
                />
                <Button type="submit" size="icon" disabled={submitting || !reply.trim()} aria-label="Send reply">
                  {submitting ? <Loader2 className="animate-spin" /> : <Send />}
                </Button>
              </form>
            </div>
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="min-h-0 px-6 pb-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="send">Send feedback</TabsTrigger>
                <TabsTrigger value="mine">
                  My feedback
                  {unreadCount > 0 ? <Badge className="ml-1 h-5 min-w-5 px-1.5">{unreadCount}</Badge> : null}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="send" className="pt-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="feedback-category">Category</Label>
                    <Select value={category} onValueChange={(value) => setCategory(value as FeedbackCategory)}>
                      <SelectTrigger id="feedback-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="feedback-message">Message</Label>
                    <Textarea
                      id="feedback-message"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      maxLength={5000}
                      className="min-h-36"
                      placeholder="Tell us what happened or what would make the admin experience better."
                    />
                    <p className="text-right text-xs text-muted-foreground">{message.length}/5000</p>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={submitting || !message.trim()}>
                      {submitting ? <Loader2 className="animate-spin" /> : <Send />}
                      Submit feedback
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="mine" className="pt-4">
                <ScrollArea className="h-[55vh] pr-3">
                  {loadingMine ? (
                    <div className="flex h-48 items-center justify-center"><Loader2 className="size-5 animate-spin" /></div>
                  ) : threads.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      You have not submitted any feedback yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {threads.map((thread) => (
                        <div key={thread.feedback_id} className="relative rounded-lg border transition-colors hover:bg-muted/50">
                          <button
                            type="button"
                            onClick={() => void openThread(thread.feedback_id)}
                            className="w-full p-4 pr-14 text-left"
                          >
                            {thread.unread ? <span className="absolute top-5 right-14 size-2 rounded-full bg-red-600" /> : null}
                            <div className="flex flex-wrap items-center gap-2 pr-5">
                              <Badge variant="secondary">{CATEGORY_LABELS[thread.category]}</Badge>
                              <StatusBadge status={thread.status} />
                              {thread.merchant ? <span className="text-xs text-muted-foreground">{thread.merchant.name}</span> : null}
                            </div>
                            <p className="mt-3 line-clamp-2 text-sm">{thread.message_preview}</p>
                            <p className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                              <Link2 className="size-3.5 shrink-0" />
                              <span className="truncate font-mono">{thread.page_path}</span>
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">Updated {formatDate(thread.updated_at)}</p>
                          </button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute top-2.5 right-2.5 size-8"
                                aria-label="Feedback actions"
                              >
                                {loadingEditId === thread.feedback_id
                                  ? <Loader2 className="size-4 animate-spin" />
                                  : <MoreHorizontal className="size-4" />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => void openThread(thread.feedback_id)}>
                                <Eye className="size-4" />
                                View info
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={loadingEditId === thread.feedback_id}
                                onSelect={() => void beginEdit(thread)}
                              >
                                <Pencil className="size-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => {
                                  setDeleteTarget(thread)
                                  setDeleteConfirmOpen(true)
                                }}
                              >
                                <Trash2 className="size-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(next) => {
        setEditOpen(next)
        if (!next && !savingEdit) setEditingThread(null)
      }}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleEdit}>
            <DialogHeader>
              <DialogTitle>Edit feedback</DialogTitle>
              <DialogDescription>
                Update the category or original message. The page URL and replies will stay unchanged.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-5">
              <div className="space-y-2">
                <Label htmlFor="edit-feedback-category">Category</Label>
                <Select value={editCategory} onValueChange={(value) => setEditCategory(value as FeedbackCategory)}>
                  <SelectTrigger id="edit-feedback-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-feedback-message">Message</Label>
                <Textarea
                  id="edit-feedback-message"
                  value={editMessage}
                  onChange={(event) => setEditMessage(event.target.value)}
                  maxLength={5000}
                  className="min-h-36"
                />
                <p className="text-right text-xs text-muted-foreground">{editMessage.length}/5000</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingEdit || !editMessage.trim()}>
                {savingEdit ? <Loader2 className="animate-spin" /> : <Pencil />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={(next) => {
        setDeleteConfirmOpen(next)
        if (!next && !deleting) setDeleteTarget(null)
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this feedback?</DialogTitle>
            <DialogDescription>
              It will be removed from My feedback and the reviewer inbox. This action cannot be undone from the app.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
