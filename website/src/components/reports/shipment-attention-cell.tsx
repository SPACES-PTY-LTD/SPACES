"use client"

import * as React from "react"
import { ClockAlert, Gauge, PackageCheck, PackageOpen } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  hasOpenShipmentAttentionTiming,
  resolveShipmentAttention,
  type ShipmentAttentionCode,
  type ShipmentAttentionInput,
} from "@/lib/shipment-attention"
import { cn } from "@/lib/utils"

type ShipmentAttentionCellProps = Omit<ShipmentAttentionInput, "now"> & {
  initialNow: string
}

const icons: Record<ShipmentAttentionCode, React.ComponentType<{ className?: string }>> = {
  undelivered_over_6_hours: ClockAlert,
  speeding: Gauge,
  pickup_dwell_over_expected: PackageOpen,
  dropoff_dwell_over_expected: PackageCheck,
}

export function ShipmentAttentionCell({ initialNow, ...input }: ShipmentAttentionCellProps) {
  const [now, setNow] = React.useState(initialNow)
  const hasOpenTiming = hasOpenShipmentAttentionTiming({ ...input, now })

  React.useEffect(() => {
    if (!hasOpenTiming) return

    const interval = window.setInterval(() => {
      setNow(new Date().toISOString())
    }, 60_000)

    return () => window.clearInterval(interval)
  }, [hasOpenTiming])

  const alerts = resolveShipmentAttention({ ...input, now })
  if (alerts.length === 0) return "-"

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        {alerts.map((alert) => {
          const Icon = icons[alert.code]
          return (
            <Tooltip key={alert.code}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={alert.tooltip}
                  className={cn(
                    "inline-flex rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2",
                    alert.tone === "danger"
                      ? "text-red-600 hover:text-red-700 focus-visible:ring-red-600"
                      : "text-amber-600 hover:text-amber-700 focus-visible:ring-amber-600"
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent sideOffset={8} className="max-w-72 text-left leading-relaxed">
                {alert.tooltip}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
