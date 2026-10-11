"use client"

import { AlertTriangle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { runStopTiming } from "@/components/runs/run-stop-timing"
import type { ShipmentStop } from "@/lib/types"

export function RunStopDuration({ stop }: { stop: ShipmentStop }) {
  const timing = runStopTiming(stop)
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">Total time at location:</span>
      <span className="font-medium tabular-nums">{timing.durationLabel}</span>
      {timing.tooltip && <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label={timing.tooltip} className="inline-flex rounded-sm text-red-600 outline-none hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
              <AlertTriangle className="size-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent sideOffset={8} className="max-w-72 text-left leading-relaxed">{timing.tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>}
    </div>
  )
}
