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
import { isApiErrorResponse } from "@/lib/api/client"
import type { QuoteOption } from "@/lib/types"
import { bookShipment } from "@/lib/api/shipments"

export function QuoteOptionBooking({
  shipmentId,
  option,
  accessToken,
  onBooked,
}: {
  shipmentId: string | undefined
  option: QuoteOption
  accessToken?: string
  onBooked?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const amountLabel = `${option.currency} ${Number(option.total_amount).toFixed(2)}`

  const handleConfirm = async () => {
    if (!shipmentId) {
      setError("Missing shipment ID.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await bookShipment(
        shipmentId,
        option.quote_option_id,
        accessToken
      )
      if (isApiErrorResponse(result)) {
        setError(result.message)
        toast.error(result.message)
        return
      }
      setOpen(false)
      onBooked?.()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to book shipment."
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Book shipment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm booking</DialogTitle>
          <DialogDescription>
            Accept this option for {amountLabel}?
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={loading}>
            {loading ? "Booking..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
