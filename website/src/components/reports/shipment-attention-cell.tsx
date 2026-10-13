"use client"

import * as React from "react"
import Link from "next/link"
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
import type { ShipmentSpeedingAlert } from "@/lib/api/reports"
import { ShipmentSpeedingAlertsDialog } from "@/components/reports/shipment-speeding-alerts-dialog"
import { AdminRoute } from "@/lib/routes/admin"

type ShipmentAttentionCellProps = Omit<ShipmentAttentionInput, "now"> & {
  initialNow: string
  speedingAlerts?: ShipmentSpeedingAlert[] | null
  shipmentNumber?: string | null
  vehiclePlateNumber?: string | null
  runId?: string | null
}

const icons: Record<ShipmentAttentionCode, React.ComponentType<{ className?: string }>> = {
  undelivered_over_6_hours: ClockAlert,
  speeding: Gauge,
  pickup_dwell_over_expected: PackageOpen,
  dropoff_dwell_over_expected: PackageCheck,
}

export function ShipmentAttentionCell({
  initialNow,
  speedingAlerts,
  shipmentNumber,
  vehiclePlateNumber,
  runId,
  ...input
}: ShipmentAttentionCellProps) {
  const [now, setNow] = React.useState(initialNow)
  const [speedingDialogOpen, setSpeedingDialogOpen] = React.useState(false)
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
    <>
      <TooltipProvider delayDuration={75} skipDelayDuration={100}>
        <div className="flex items-center gap-0.5">
          {alerts.map((alert) => {
            const Icon = icons[alert.code]
            const runHref = alert.code === "speeding" && runId ? AdminRoute.runDetails(runId) : undefined
            const opensSpeedingDialog = alert.code === "speeding" && !runHref
            const iconClassName = cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2",
              runHref || opensSpeedingDialog ? "cursor-pointer" : "cursor-help",
              alert.tone === "danger"
                ? "text-red-600 hover:text-red-700 focus-visible:ring-red-600"
                : "text-amber-600 hover:text-amber-700 focus-visible:ring-amber-600"
            )
            return (
              <Tooltip key={alert.code}>
                <TooltipTrigger asChild>
                  {runHref ? <Link href={runHref} aria-label={`${alert.tooltip} View run details.`} className={iconClassName}>
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </Link> : <button
                    type="button"
                    aria-label={alert.tooltip}
                    aria-haspopup={opensSpeedingDialog ? "dialog" : undefined}
                    onClick={
                      opensSpeedingDialog
                        ? () => setSpeedingDialogOpen(true)
                        : undefined
                    }
                    className={iconClassName}
                  >
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </button>}
                </TooltipTrigger>
                <TooltipContent sideOffset={8} className="max-w-72 text-left leading-relaxed">
                  {alert.tooltip}
                  {runHref ? " Click to view run details." : opensSpeedingDialog ? " Click to view all alerts." : ""}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
      <ShipmentSpeedingAlertsDialog
        open={speedingDialogOpen}
        onOpenChange={setSpeedingDialogOpen}
        alerts={speedingAlerts}
        shipmentNumber={shipmentNumber}
        vehiclePlateNumber={vehiclePlateNumber}
      />
    </>
  )
}
