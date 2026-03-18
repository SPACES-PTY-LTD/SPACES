"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { DriverDialogContent } from "@/components/dashboard/driver-dialog-content"

export function DriverMapDialog({
  open,
  driverId,
  accessToken,
  merchantId,
  onOpenChange,
}: {
  open: boolean
  driverId?: string | null
  accessToken: string
  merchantId?: string | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[2147483647] max-h-[92vh] overflow-y-auto sm:max-w-5xl"
        overlayClassName="z-[2147483647]"
      >
        <DialogTitle className="sr-only">Driver details</DialogTitle>
        <DialogDescription className="sr-only">
          Driver profile and vehicle assignments.
        </DialogDescription>
        {driverId ? (
          <DriverDialogContent
            driverId={driverId}
            accessToken={accessToken}
            merchantId={merchantId}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
