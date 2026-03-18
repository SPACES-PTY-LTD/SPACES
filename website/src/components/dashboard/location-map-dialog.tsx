"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { LocationDialogContent } from "@/components/dashboard/location-dialog-content"

export function LocationMapDialog({
  open,
  locationId,
  accessToken,
  merchantId,
  onOpenChange,
}: {
  open: boolean
  locationId?: string | null
  accessToken: string
  merchantId?: string | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[2147483647] max-h-[92vh] overflow-y-auto sm:max-w-6xl"
        overlayClassName="z-[2147483647]"
      >
        <DialogTitle className="sr-only">Location details</DialogTitle>
        <DialogDescription className="sr-only">
          Location details and coordinates.
        </DialogDescription>
        {locationId ? (
          <LocationDialogContent
            locationId={locationId}
            accessToken={accessToken}
            merchantId={merchantId}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
