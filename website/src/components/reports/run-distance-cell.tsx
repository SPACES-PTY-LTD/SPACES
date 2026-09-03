"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { isApiErrorResponse } from "@/lib/api/client"
import { getRun } from "@/lib/api/runs"
import { formatAddress } from "@/lib/address"
import { AdminRoute } from "@/lib/routes/admin"
import type { Location, Run } from "@/lib/types"

type RunDistanceCellProps = {
  runId?: string | null
  displayValue: React.ReactNode
  accessToken?: string | null
}

function formatKm(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "-"
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return "-"
  return `${numeric.toLocaleString("en-ZA", { maximumFractionDigits: 2 })} km`
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function locationLabel(location?: Location | null) {
  if (!location) return "-"
  return location.name || location.company || location.code || formatAddress(location) || "-"
}

function locationAddress(location?: Location | null) {
  if (!location) return null
  const address = formatAddress(location)
  const label = locationLabel(location)
  return address && address !== label ? address : null
}

export function RunDistanceCell({ runId, displayValue, accessToken }: RunDistanceCellProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [run, setRun] = React.useState<Run | null>(null)

  async function loadRun() {
    if (!runId) return
    setLoading(true)
    setError(null)
    const response = await getRun(runId, accessToken)
    setLoading(false)

    if (isApiErrorResponse(response)) {
      setRun(null)
      setError(response.message || "Unable to load run shipments.")
      return
    }

    setRun(response)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) void loadRun()
  }

  if (!runId) return <>{displayValue}</>

  const shipments = run?.shipments ?? []
  const recordedDistances = shipments
    .flatMap((shipment) => {
      const value = shipment.total_km_from_collection
      return value === null || value === undefined || value === "" ? [] : [Number(value)]
    })
    .filter((value) => Number.isFinite(value))
  const shipmentTotal = recordedDistances.reduce((total, value) => total + value, 0)
  const missingDistanceCount = shipments.length - recordedDistances.length

  return (
    <>
      <Button
        type="button"
        variant="link"
        className="h-auto p-0 font-normal"
        onClick={() => handleOpenChange(true)}
        aria-haspopup="dialog"
      >
        {displayValue}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[85dvh] min-h-0 flex-col overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 border-b px-6 py-5 pr-14">
            <DialogTitle>Run KM details</DialogTitle>
            <DialogDescription className="break-all">
              Run {runId}. Compare its odometer distance with the recorded distance for each attached shipment.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <div className="flex min-h-52 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Loading run shipments…
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
                <p>{error}</p>
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void loadRun()}>
                  Try again
                </Button>
              </div>
            ) : run ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">Run odometer KM</p>
                    <p className="mt-1 text-xl font-semibold">{formatKm(run.odometer_distance_km)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatKm(run.odometer_start_km)} → {formatKm(run.odometer_end_km)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">Recorded shipment KM total</p>
                    <p className="mt-1 text-xl font-semibold">
                      {recordedDistances.length > 0 ? formatKm(shipmentTotal) : "-"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {missingDistanceCount > 0
                        ? `${missingDistanceCount} shipment${missingDistanceCount === 1 ? "" : "s"} missing KM`
                        : `${shipments.length} shipment${shipments.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Shipment distances can overlap when multiple shipments travel together, so their recorded total may be higher than the run odometer KM.
                </p>

                <div className="overflow-hidden rounded-lg border">
                  <Table className="min-w-[1080px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Shipment</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead className="w-[170px]">From Time</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead className="w-[170px]">To Time</TableHead>
                        <TableHead className="w-[140px] text-right">Total KM</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shipments.length > 0 ? shipments.map((shipment) => (
                        <TableRow key={shipment.shipment_id}>
                          <TableCell>
                            <Link
                              href={AdminRoute.shipmentDetails(shipment.shipment_id)}
                              className="font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {shipment.merchant_order_ref || shipment.shipment_id}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{locationLabel(shipment.pickup_location)}</p>
                            {locationAddress(shipment.pickup_location) ? (
                              <p className="mt-1 text-xs text-muted-foreground">{locationAddress(shipment.pickup_location)}</p>
                            ) : null}
                          </TableCell>
                          <TableCell>{formatDateTime(shipment.collected_at)}</TableCell>
                          <TableCell>
                            <p className="font-medium">{locationLabel(shipment.dropoff_location)}</p>
                            {locationAddress(shipment.dropoff_location) ? (
                              <p className="mt-1 text-xs text-muted-foreground">{locationAddress(shipment.dropoff_location)}</p>
                            ) : null}
                          </TableCell>
                          <TableCell>{formatDateTime(shipment.delivered_at)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatKm(shipment.total_km_from_collection)}
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                            No shipments are attached to this run.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    {shipments.length > 0 ? (
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={5} className="text-right">Recorded total</TableCell>
                          <TableCell className="text-right">
                            {recordedDistances.length > 0 ? formatKm(shipmentTotal) : "-"}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    ) : null}
                  </Table>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
