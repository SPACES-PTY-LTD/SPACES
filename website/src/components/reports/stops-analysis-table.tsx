"use client"

import { DataTable } from "@/components/common/data-table"
import { StopAnalysisLocationDrawer, type StopAnalysisTableRow } from "./stops-analysis-location-drawer"

export function StopsAnalysisTable({ rows, rangeLabel }: { rows: StopAnalysisTableRow[]; rangeLabel: string }) {
  return (
  <DataTable
    data={rows}
    emptyMessage="No stop activity data found."
    enableSorting
    sortableColumns={[
      "locationName",
      "visitCount",
      "uniqueVehicleCount",
      "averageDwellDisplay",
      "maxDwellDisplay",
      "openVisits",
      "latestVisitDisplay",
    ]}
    sortKeyMap={{
      locationName: "stop",
      visitCount: "visits",
      uniqueVehicleCount: "vehicles",
      averageDwellDisplay: "avg_dwell",
      maxDwellDisplay: "max_dwell",
      openVisits: "open_visits",
      latestVisitDisplay: "latest_visit",
    }}
    columns={[
      {
        key: "locationName", label: "Stop",
        customValue: (row) => <StopAnalysisLocationDrawer row={row} rangeLabel={rangeLabel} />,
        description: "The geofenced location where visits were recorded. Select its name to view location statistics, vehicles and recorded visits for the selected report period.",
      },
      {
        key: "visitCount", label: "Visits",
        description: "The number of distinct truck visits in the loaded report data. Entry starts a visit; another visit requires a recorded exit followed by re-entry. Repeated entries while the truck remains at the location count once.",
      },
      {
        key: "uniqueVehicleCount", label: "Unique vehicles",
        description: "The number of distinct vehicles with a recorded visit at this stop. Entries without a vehicle ID, saved location ID or valid entry time are excluded from visit analysis.",
      },
      {
        key: "averageDwellDisplay", label: "Avg dwell",
        description: "The average time in minutes between entry and exit for visits with valid timestamps. Visits without a valid duration are excluded; a dash means none are available.",
      },
      {
        key: "maxDwellDisplay", label: "Max dwell",
        description: "The longest time in minutes between entry and exit for a visit with valid timestamps. A dash means no valid durations are available.",
      },
      {
        key: "openVisits", label: "Open visits",
        description: "Visits without a valid entry-to-exit duration, including visits with no recorded exit, missing or invalid timestamps, or an exit before entry.",
      },
      {
        key: "latestVisitDisplay", label: "Latest visit",
        description: "The most recent visit timestamp at this stop, using the exit time when present, otherwise the entry time, then the activity occurrence time.",
      },
    ]}
  />
  )
}
