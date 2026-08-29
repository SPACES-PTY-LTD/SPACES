"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  formatMinuteCount,
  resolveDwellTime,
} from "@/lib/dwell-time"

type ShipmentDwellTimeCellProps = {
  enteredAt?: string | null
  exitedAt?: string | null
  expectedWaitingTime?: number | null
  initialNow: string
  shipmentHref?: string
}

export function ShipmentDwellTimeCell({
  enteredAt,
  exitedAt,
  expectedWaitingTime,
  initialNow,
  shipmentHref,
}: ShipmentDwellTimeCellProps) {
  const [now, setNow] = React.useState(initialNow)
  const isOpen = Boolean(enteredAt && !exitedAt)

  React.useEffect(() => {
    if (!isOpen) return

    const interval = window.setInterval(() => {
      setNow(new Date().toISOString())
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [isOpen])

  const dwell = resolveDwellTime({
    enteredAt,
    exitedAt,
    now,
    expectedWaitingTime,
  })
  const duration = shipmentHref ? (
    <Link
      href={shipmentHref}
      className="text-primary underline-offset-4 hover:underline"
    >
      {dwell.durationLabel}
    </Link>
  ) : (
    dwell.durationLabel
  )

  if (!dwell.isOverExpected || dwell.overageMinutes === null) {
    return duration
  }

  const tooltip = `This truck is ${formatMinuteCount(dwell.overageMinutes)} over the expected waiting time for this location. Expected waiting time: ${formatMinuteCount(expectedWaitingTime as number)}.`

  return (
    <div className="inline-flex items-center gap-1.5">
      {duration}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={tooltip}
              className="inline-flex rounded-sm text-red-600 outline-none transition-colors hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
            >
              <AlertTriangle className="size-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent sideOffset={8} className="max-w-xs text-left leading-relaxed">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
