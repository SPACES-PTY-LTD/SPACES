"use client"

import * as React from "react"
import { MappedBookingsMapCard } from "@/components/dashboard/mapped-bookings-map-card"
import { ShipmentMapDialog } from "@/components/dashboard/shipment-map-dialog"

export function LiveBookingsMapSection({
  accessToken,
  merchantId,
}: {
  accessToken: string
  merchantId?: string | null
}) {
  const [selectedShipmentId, setSelectedShipmentId] = React.useState<string | null>(
    null
  )

  return (
    <>
      <MappedBookingsMapCard
        accessToken={accessToken}
        merchantId={merchantId}
        selectedShipmentId={selectedShipmentId}
        onSelectShipment={setSelectedShipmentId}
      />
      <ShipmentMapDialog
        open={Boolean(selectedShipmentId)}
        shipmentId={selectedShipmentId}
        accessToken={accessToken}
        merchantId={merchantId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedShipmentId(null)
          }
        }}
      />
    </>
  )
}
