"use client"

import { RecordedStopAutomationPopover } from "./recorded-stop-automation-popover"
import { DataTable } from "@/components/common/data-table"
import { LocationDetailsDrawer } from "@/components/locations/location-details-drawer"
import { Badge } from "@/components/ui/badge"
import { RecordedStopDrawer } from "@/components/runs/recorded-stop-drawer"
import { RunStopDuration } from "@/components/runs/run-stop-duration"
import type { ShipmentStop } from "@/lib/types"

export function RecordedStopsTable({ stops, activities, accessToken, merchantId, initialNow }: {
  stops: ShipmentStop[]
  activities: ShipmentStop[]
  accessToken: string
  merchantId?: string | null
  initialNow: string
}) {
  const rows = stops.map((stop, index) => ({
    id: stop.activity_id ?? String(index),
    sequence: index + 1,
    locationName: stop.location?.name || stop.location?.company || stop.shipment?.merchant_order_ref || "Recorded stop",
    locationType: stop.location?.type?.title?.trim() || "",
    event: (stop.event_type ?? "stop").replaceAll("_", " "),
    occurredAt: stop.occurred_at,
    stop,
  }))

  return <DataTable
    data={rows}
    searchKeys={["locationName", "locationType", "event"]}
    emptyMessage="No stop events were recorded for this run."
    columns={[
      { key: "sequence", label: "#", className: "w-12" },
      { key: "locationName", label: "Location", className: "min-w-[240px] whitespace-normal", customValue: row => (
        row.stop.location?.location_id
          ? <LocationDetailsDrawer locationId={row.stop.location.location_id} label={row.locationName} accessToken={accessToken} merchantId={merchantId} />
          : <RecordedStopDrawer stop={row.stop} label={row.locationName} accessToken={accessToken} merchantId={merchantId} />
      ) },
      { key: "locationType", label: "Type", customValue: row => row.locationType ? <Badge variant="outline">{row.locationType}</Badge> : null },
      { key: "event", label: "Event", className: "capitalize" },
      { key: "automation", label: "Automation", customValue: row => <RecordedStopAutomationPopover metadata={row.stop.metadata} /> },
      { key: "occurredAt", label: "Time", type: "date_time" },
      { key: "latitude", label: "Latitude", description: "Latitude recorded for this stop event.", customValue: row => row.stop.latitude != null && Number.isFinite(row.stop.latitude) ? row.stop.latitude.toFixed(6) : "—" },
      { key: "longitude", label: "Longitude", description: "Longitude recorded for this stop event.", customValue: row => row.stop.longitude != null && Number.isFinite(row.stop.longitude) ? row.stop.longitude.toFixed(6) : "—" },
      { key: "duration", label: "Duration", className: "min-w-[240px] whitespace-normal", customValue: row => <RunStopDuration stop={row.stop} activities={activities} initialNow={initialNow} /> },
    ]}
  />
}
