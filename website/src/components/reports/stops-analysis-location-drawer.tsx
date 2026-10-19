"use client"

import * as React from "react"
import { DataTable } from "@/components/common/data-table"
import { sortStopAnalysisRows } from "./stops-analysis-sort"
import Link from "next/link"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { Badge } from "@/components/ui/badge"
import type { StopAnalysisRow, StopAnalysisVehicle, StopAnalysisVisit } from "./stops-analysis-visits"

export type StopAnalysisTableRow = StopAnalysisRow & {
  stopHref: string
  averageDwellDisplay: string
  maxDwellDisplay: string
  latestVisitDisplay: string
  vehicles: StopAnalysisVehicle[]
  visits: (StopAnalysisVisit & { entryDisplay: string; exitDisplay: string })[]
}

function minutes(value: number | null) {
  return value === null ? "Not available" : `${value.toFixed(1)} min`
}

export function StopAnalysisLocationDrawer({ row, rangeLabel }: { row: StopAnalysisTableRow; rangeLabel: string }) {
  const [vehicleSort, setVehicleSort] = React.useState({ key: "visitCount", direction: "desc" as "asc" | "desc" })
  const [visitSort, setVisitSort] = React.useState({ key: "enteredAt", direction: "desc" as "asc" | "desc" })
  const visits = row.visits.map(visit => ({ ...visit, status: visit.exitedAt ? "Completed" : "Open" }))
  return <Drawer>
    <DrawerTrigger asChild>
      <button type="button" className="rounded-sm text-left underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`View stop analysis for ${row.locationName}`}>{row.locationName}</button>
    </DrawerTrigger>
    <DrawerContent side="right" className="sm:w-[min(94vw,1100px)]">
      <DrawerHeader className="shrink-0 border-b p-5 pr-12">
        <DrawerTitle className="text-xl">{row.locationName}</DrawerTitle>
        <DrawerDescription>{rangeLabel}</DrawerDescription>
        {row.stopHref && <Link href={row.stopHref} className="text-sm text-primary underline underline-offset-4">View saved location</Link>}
      </DrawerHeader>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[
            ["Visits", row.visitCount],
            ["Unique vehicles", row.uniqueVehicleCount],
            ["Open visits", row.openVisits],
            ["Avg dwell", minutes(row.averageDwellMinutes)],
            ["Max dwell", minutes(row.maxDwellMinutes)],
            ["Latest visit", row.latestVisitDisplay],
          ].map(([label, value]) => <div key={label} className="rounded-lg border p-3">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words font-semibold tabular-nums">{value}</dd>
          </div>)}
        </dl>
        <section className="space-y-3" aria-label="Vehicle statistics">
          <h2 className="font-semibold">Vehicles</h2>
          <DataTable
            data={sortStopAnalysisRows(row.vehicles, vehicleSort.key, vehicleSort.direction)}
            enableSorting
            sorting={{ ...vehicleSort, onChange: (key, direction) => setVehicleSort({ key, direction }) }}
            emptyMessage="No vehicles recorded for this period."
            columns={[
              { key: "vehicleLabel", label: "Vehicle" },
              { key: "visitCount", label: "Visits" },
              { key: "totalDwellMinutes", label: "Completed dwell", customValue: vehicle => minutes(vehicle.totalDwellMinutes) },
              { key: "averageDwellMinutes", label: "Avg dwell", customValue: vehicle => minutes(vehicle.averageDwellMinutes) },
              { key: "maxDwellMinutes", label: "Max dwell", customValue: vehicle => minutes(vehicle.maxDwellMinutes) },
              { key: "openVisits", label: "Open visits" },
            ]}
          />
        </section>
        <section className="space-y-3" aria-label="Recorded visits">
          <h2 className="font-semibold">Recorded visits</h2>
          <DataTable
            data={sortStopAnalysisRows(visits, visitSort.key, visitSort.direction)}
            enableSorting
            sorting={{ ...visitSort, onChange: (key, direction) => setVisitSort({ key, direction }) }}
            emptyMessage="No visits recorded for this period."
            columns={[
              { key: "vehicleLabel", label: "Vehicle" },
              { key: "enteredAt", label: "Entered", customValue: visit => visit.entryDisplay },
              { key: "exitedAt", label: "Exited", customValue: visit => visit.exitedAt ? visit.exitDisplay : "No recorded exit" },
              { key: "dwellMinutes", label: "Dwell", customValue: visit => minutes(visit.dwellMinutes) },
              { key: "status", label: "Status", customValue: visit => <Badge variant="outline">{visit.status}</Badge> },
            ]}
          />
        </section>
        <p className="text-xs text-muted-foreground">These statistics use the same loaded records as the report. Repeated entries count once until a recorded exit and re-entry. Dwell includes completed visits only; open visits have no confirmed duration.</p>
      </div>
    </DrawerContent>
  </Drawer>
}
