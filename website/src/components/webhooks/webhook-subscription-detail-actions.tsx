"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { isApiErrorResponse } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import { AVAILABLE_WEBHOOK_EVENT_TYPES } from "@/lib/webhooks"
import {
  deleteWebhookSubscription,
  testWebhookSubscription,
  updateWebhookSubscription,
} from "@/lib/api/webhooks"

export function WebhookSubscriptionDetailActions({
  subscriptionId,
  accessToken,
  backHref,
  initialUrl,
  initialEventTypes,
}: {
  subscriptionId: string
  accessToken?: string | null
  backHref: string
  initialUrl: string
  initialEventTypes: string[]
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [url, setUrl] = React.useState(initialUrl)
  const [selectedEventTypes, setSelectedEventTypes] = React.useState<string[]>(
    initialEventTypes
  )

  const availableEventTypes = React.useMemo(() => {
    const known = new Set(AVAILABLE_WEBHOOK_EVENT_TYPES.map((option) => option.value))
    const unknownFromSubscription = initialEventTypes
      .filter((eventType) => !known.has(eventType))
      .map((eventType) => ({
        value: eventType,
        label: eventType,
        description: "Legacy/custom event currently saved on this subscription.",
      }))

    return [...AVAILABLE_WEBHOOK_EVENT_TYPES, ...unknownFromSubscription]
  }, [initialEventTypes])

  React.useEffect(() => {
    if (!editOpen) {
      setUrl(initialUrl)
      setSelectedEventTypes(initialEventTypes)
    }
  }, [editOpen, initialUrl, initialEventTypes])

  const runEdit = async () => {
    const trimmedUrl = url.trim()
    const eventTypes = selectedEventTypes.filter((value) => value.trim().length > 0)

    if (!trimmedUrl) {
      toast.error("Endpoint URL is required.")
      return
    }
    if (eventTypes.length === 0) {
      toast.error("Add at least one event type.")
      return
    }

    setSaving(true)
    try {
      const result = await updateWebhookSubscription(
        subscriptionId,
        {
          url: trimmedUrl,
          event_types: eventTypes,
        },
        accessToken
      )
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Webhook subscription updated.")
      setEditOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update subscription."
      )
    } finally {
      setSaving(false)
    }
  }

  const runTest = async () => {
    setTesting(true)
    try {
      const result = await testWebhookSubscription(subscriptionId, accessToken)
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Webhook test queued.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to test webhook.")
    } finally {
      setTesting(false)
    }
  }

  const runDelete = async () => {
    setDeleting(true)
    try {
      const result = await deleteWebhookSubscription(subscriptionId, accessToken)
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Webhook subscription deleted.")
      setDeleteOpen(false)
      router.push(backHref)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete subscription."
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={testing || saving || deleting}>
            Actions
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              if (testing || saving || deleting) return
              setEditOpen(true)
            }}
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              if (testing || saving || deleting) return
              void runTest()
            }}
          >
            {testing ? "Testing..." : "Test"}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault()
              if (testing || saving || deleting) return
              setDeleteOpen(true)
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit subscription</DialogTitle>
            <DialogDescription>
              Update the endpoint URL and subscribed event types.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/webhooks/pickndrop"
              />
            </div>
            <div className="space-y-2">
              <Label>Event types</Label>
              <div className="grid gap-2">
                {availableEventTypes.map((option) => {
                  const checked = selectedEventTypes.includes(option.value)
                  return (
                    <div
                      key={option.value}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-md border p-3 transition-colors",
                        checked
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/60 bg-background"
                      )}
                    >
                      <div className="space-y-1">
                        <span className="block text-sm font-medium">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {option.description}
                        </span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {option.value}
                        </span>
                      </div>
                      <Switch
                        aria-label={`Toggle ${option.label}`}
                        checked={checked}
                        onCheckedChange={(nextChecked) => {
                          setSelectedEventTypes((prev) => {
                            if (nextChecked) {
                              if (prev.includes(option.value)) return prev
                              return [...prev, option.value]
                            }
                            return prev.filter((value) => value !== option.value)
                          })
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void runEdit()} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete subscription</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Webhook delivery history will remain,
              but no new deliveries will be sent to this endpoint.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void runDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Confirm delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
