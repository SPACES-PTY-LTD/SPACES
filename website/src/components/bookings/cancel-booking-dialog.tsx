"use client"

import * as React from "react"
import { toast } from "sonner"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { isApiErrorResponse } from "@/lib/api/client"
import { listPublicCancelReasons } from "@/lib/api/cancel-reasons"
import { cancelShipment } from "@/lib/api/bookings"
import type { CancelReason } from "@/lib/types"

const hardcodedOtherReason: CancelReason = {
  cancel_reason_id: "other",
  code: "other",
  title: "Other",
  enabled: true,
}

export function CancelBookingDialog({
  shipmentId,
  accessToken,
  onCancelled,
}: {
  shipmentId?: string
  accessToken?: string
  onCancelled?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [reasons, setReasons] = React.useState<CancelReason[]>([])
  const [selectedCode, setSelectedCode] = React.useState<string>("")
  const [reasonNote, setReasonNote] = React.useState("")

  React.useEffect(() => {
    if (!open) return
    let active = true
    ;(async () => {
      try {
        const response = await listPublicCancelReasons(accessToken)
        if (!active) return
        if (isApiErrorResponse(response)) {
          toast.error(response.message)
          return
        }
        const merged = [
          ...(response.data ?? []),
          hardcodedOtherReason,
        ].filter(Boolean)
        const unique = Array.from(
          new Map(merged.map((reason) => [reason.code, reason])).values()
        )
        setReasons(unique)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load cancel reasons."
        )
      }
    })()
    return () => {
      active = false
    }
  }, [open, accessToken])

  const resetState = () => {
    setSelectedCode("")
    setReasonNote("")
  }

  const handleCancel = async () => {
    if (!shipmentId) {
      toast.error("Missing shipment ID.")
      return
    }
    if (!selectedCode) {
      toast.error("Select a cancellation reason.")
      return
    }
    setLoading(true)
    try {
      const result = await cancelShipment(
        shipmentId,
        {
          reason_code: selectedCode,
          reason_note: selectedCode === "other" ? reasonNote : undefined,
        },
        accessToken
      )
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Booking cancelled.")
      setOpen(false)
      resetState()
      onCancelled?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel booking.")
    } finally {
      setLoading(false)
    }
  }

  const selectedIsOther = selectedCode === "other"
  const cancelDisabled =
    loading || !selectedCode || (selectedIsOther && !reasonNote.trim())

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Cancel booking</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel booking</DialogTitle>
          <DialogDescription>
            Select a reason for cancelling this booking.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Reason</div>
            <Select value={selectedCode} onValueChange={setSelectedCode}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((reason) => (
                  <SelectItem key={reason.code} value={reason.code}>
                    {reason.title ?? reason.label ?? reason.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedIsOther ? (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Reason note</div>
              <Textarea
                value={reasonNote}
                onChange={(event) => setReasonNote(event.target.value)}
                placeholder="Add a note for why this booking is being cancelled."
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false)
              resetState()
            }}
            disabled={loading}
          >
            Close
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelDisabled}
          >
            {loading ? "Cancelling..." : "Confirm cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
