"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RunStopJourney } from "@/components/runs/run-stop-journey"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import { getRun } from "@/lib/api/runs"
import type { Run } from "@/lib/types"

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
      setError(response.message || "Unable to load run details.")
      return
    }

    setRun(response)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) void loadRun()
  }

  if (!runId) return <>{displayValue}</>

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
        <DialogContent className="flex max-h-[90dvh] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1140px,calc(100vw-2rem))]">
          <DialogHeader className="shrink-0 border-b px-6 py-5 pr-14">
            <DialogTitle>Run KM details</DialogTitle>
            <DialogDescription className="break-all">
              Run {runId}. Follow every stop and see how each leg contributes to the total KM.
            </DialogDescription>
          </DialogHeader>

          {run && !loading && !error ? (
            <dl className="grid shrink-0 grid-cols-2 gap-4 border-b px-4 py-4 sm:grid-cols-3 sm:px-6 sm:py-5">
              <div><dt className="text-xs text-muted-foreground">Run total</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{formatKm(run.distance_km ?? run.odometer_distance_km)}</dd></div>
              <div className="sm:border-l sm:pl-5"><dt className="text-xs text-muted-foreground">Odometer readings</dt><dd className="mt-2 text-sm font-semibold tabular-nums">{formatKm(run.odometer_start_km)} → {formatKm(run.odometer_end_km)}</dd></div>
              <div className="col-span-2 sm:col-span-1 sm:border-l sm:pl-5"><dt className="text-xs text-muted-foreground">Distance source</dt><dd className="mt-1 text-lg font-semibold capitalize">{run.distance_source || "Unavailable"}</dd></div>
            </dl>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6">
            {loading ? (
              <div className="flex min-h-52 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Loading run stops…
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
                <p>{error}</p>
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void loadRun()}>
                  Try again
                </Button>
              </div>
            ) : run ? (
              <RunStopJourney run={run} layout="timeline" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
