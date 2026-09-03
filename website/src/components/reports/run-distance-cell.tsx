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
        <DialogContent className="flex max-h-[85dvh] min-h-0 flex-col overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 border-b px-6 py-5 pr-14">
            <DialogTitle>Run KM details</DialogTitle>
            <DialogDescription className="break-all">
              Run {runId}. Follow every stop and see how each leg contributes to the total KM.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">Run total KM</p>
                    <p className="mt-1 text-xl font-semibold">
                      {formatKm(run.distance_km ?? run.odometer_distance_km)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {run.distance_source === "odometer"
                        ? `${formatKm(run.odometer_start_km)} → ${formatKm(run.odometer_end_km)}`
                        : "Calculated from the recorded route"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">Distance source</p>
                    <p className="mt-1 text-xl font-semibold capitalize">{run.distance_source || "Unavailable"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {run.distance_source === "odometer"
                        ? "Run start and end odometer readings"
                        : run.distance_source === "gps"
                          ? "Recorded vehicle GPS route"
                          : "No distance source recorded"}
                    </p>
                  </div>
                </div>

                <RunStopJourney run={run} />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
