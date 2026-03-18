"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { isApiErrorResponse } from "@/lib/api/client"
import { assignDriver } from "@/lib/api/bookings"
import { CancelBookingDialog } from "@/components/bookings/cancel-booking-dialog"

export function BookingActions({
  bookingId,
  shipmentId,
  accessToken,
}: {
  bookingId?: string
  shipmentId?: string
  accessToken?: string
}) {
  const router = useRouter()
  const [assigning, setAssigning] = React.useState(false)

  const handleAssign = async () => {
    if (!bookingId) {
      toast.error("Missing booking ID.")
      return
    }
    setAssigning(true)
    try {
      const result = await assignDriver(bookingId, accessToken)
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Driver assigned.")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign driver.")
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={handleAssign} disabled={assigning}>
        {assigning ? "Assigning..." : "Assign driver"}
      </Button>
      <CancelBookingDialog
        shipmentId={shipmentId}
        accessToken={accessToken}
        onCancelled={() => router.refresh()}
      />
    </div>
  )
}
