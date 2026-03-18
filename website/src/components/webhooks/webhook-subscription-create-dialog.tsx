"use client"

import * as React from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { isApiErrorResponse } from "@/lib/api/client"
import { createWebhookSubscription } from "@/lib/api/webhooks"
import { AVAILABLE_WEBHOOK_EVENT_TYPES } from "@/lib/webhooks"
import { cn } from "@/lib/utils"

export function WebhookSubscriptionCreateDialog({
  accessToken,
  merchantId,
}: {
  accessToken?: string | null
  merchantId?: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [url, setUrl] = React.useState("")
  const [selectedEventTypes, setSelectedEventTypes] = React.useState<string[]>(
    AVAILABLE_WEBHOOK_EVENT_TYPES.map((option) => option.value)
  )

  React.useEffect(() => {
    if (!open) {
      setUrl("")
      setSelectedEventTypes(AVAILABLE_WEBHOOK_EVENT_TYPES.map((option) => option.value))
    }
  }, [open])

  const handleCreate = async () => {
    if (!merchantId) {
      toast.error("Select a merchant before creating a subscription.")
      return
    }

    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      toast.error("Endpoint URL is required.")
      return
    }
    if (selectedEventTypes.length === 0) {
      toast.error("Add at least one event type.")
      return
    }

    setSaving(true)
    try {
      const result = await createWebhookSubscription(
        {
          merchant_id: merchantId,
          url: trimmedUrl,
          event_types: selectedEventTypes,
        },
        accessToken
      )
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Webhook subscription created.")
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create subscription."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New subscription</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create subscription</DialogTitle>
          <DialogDescription>
            Register a webhook endpoint and choose subscribed event types.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="new-webhook-url">Endpoint URL</Label>
            <Input
              id="new-webhook-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/webhooks/pickndrop"
            />
          </div>
          <div className="space-y-2">
            <Label>Event types</Label>
            <div className="grid gap-2">
              {AVAILABLE_WEBHOOK_EVENT_TYPES.map((option) => {
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
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleCreate()} disabled={saving}>
            {saving ? "Creating..." : "Create subscription"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
