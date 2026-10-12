"use client"

import Link from "next/link"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
          <Table className="min-w-[750px] table-auto">
            <TableHeader><TableRow>
              {["Vehicle", "Visits", "Completed dwell", "Avg dwell", "Max dwell", "Open visits"].map(label => <TableHead key={label}>{label}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {row.vehicles.map(vehicle => <TableRow key={vehicle.vehicleId}>
                <TableCell className="font-medium">{vehicle.vehicleLabel}</TableCell>
                <TableCell>{vehicle.visitCount}</TableCell>
                <TableCell>{minutes(vehicle.totalDwellMinutes)}</TableCell>
                <TableCell>{minutes(vehicle.averageDwellMinutes)}</TableCell>
                <TableCell>{minutes(vehicle.maxDwellMinutes)}</TableCell>
                <TableCell>{vehicle.openVisits}</TableCell>
              </TableRow>)}
              {!row.vehicles.length && <TableRow><TableCell colSpan={6}>No vehicles recorded for this period.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </section>
        <section className="space-y-3" aria-label="Recorded visits">
          <h2 className="font-semibold">Recorded visits</h2>
          <Table className="min-w-[750px] table-auto">
            <TableHeader><TableRow>
              {["Vehicle", "Entered", "Exited", "Dwell", "Status"].map(label => <TableHead key={label}>{label}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {row.visits.map((visit, index) => <TableRow key={`${visit.vehicleId}-${visit.enteredAt}-${index}`}>
                <TableCell className="font-medium">{visit.vehicleLabel}</TableCell>
                <TableCell className="whitespace-nowrap">{visit.entryDisplay}</TableCell>
                <TableCell className="whitespace-nowrap">{visit.exitedAt ? visit.exitDisplay : "No recorded exit"}</TableCell>
                <TableCell className="whitespace-nowrap">{minutes(visit.dwellMinutes)}</TableCell>
                <TableCell><Badge variant="outline">{visit.exitedAt ? "Completed" : "Open"}</Badge></TableCell>
              </TableRow>)}
              {!row.visits.length && <TableRow><TableCell colSpan={5}>No visits recorded for this period.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </section>
        <p className="text-xs text-muted-foreground">These statistics use the same loaded records as the report. Repeated entries count once until a recorded exit and re-entry. Dwell includes completed visits only; open visits have no confirmed duration.</p>
      </div>
    </DrawerContent>
  </Drawer>
}
