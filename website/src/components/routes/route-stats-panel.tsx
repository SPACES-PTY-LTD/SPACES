"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { RouteStats } from "@/lib/types"
import { Info } from "lucide-react"

type RouteStatsPanelProps = {
  stats: RouteStats | null
  errorMessage?: string | null
}

function formatNumber(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-"
  }
  return `${new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 2 }).format(value)}${suffix}`
}

function tooltipLabel(title: string, tooltip: string) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>{title}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={`Info: ${title}`} className="inline-flex">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent sideOffset={8} className="max-w-xs text-left leading-relaxed">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export function RouteStatsPanel({ stats, errorMessage }: RouteStatsPanelProps) {
  if (errorMessage) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">{errorMessage}</CardContent>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No route efficiency stats available yet.
        </CardContent>
      </Card>
    )
  }

  const summary = stats.summary
  const breakdown = stats.time_breakdown
  const timeline = stats.timeline ?? []
  const averages = stats.averages
  const deltas = stats.deltas

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <div className="text-sm font-medium">Route Efficiency</div>
              <div className="text-xs text-muted-foreground">
                Generated {new Date(stats.generated_at).toLocaleString("en-ZA")}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              <div>
                {tooltipLabel(
                  "Actual Distance",
                  "Total GPS-derived distance covered during the run."
                )}
                <div className="text-lg font-semibold">
                  {formatNumber(summary.actual_distance_km, " km")}
                </div>
              </div>
              <div>
                {tooltipLabel(
                  "Distance Variance",
                  "Difference between actual GPS distance and planned route distance."
                )}
                <div className="text-lg font-semibold">
                  {formatNumber(summary.distance_variance_km, " km")} (
                  {formatNumber(summary.distance_variance_pct, "%")})
                </div>
              </div>
              <div>
                {tooltipLabel(
                  "Driving Time",
                  "Time moving above the configured movement threshold."
                )}
                <div className="text-lg font-semibold">
                  {formatNumber(summary.driving_time_min, " min")}
                </div>
              </div>
              <div>
                {tooltipLabel(
                  "Idle Time",
                  "Time where the run is active but the vehicle is not moving."
                )}
                <div className="text-lg font-semibold">
                  {formatNumber(summary.idle_time_min, " min")}
                </div>
              </div>
              <div>
                {tooltipLabel(
                  "Utilization",
                  "Percentage of total route duration spent moving."
                )}
                <div className="text-lg font-semibold">
                  {formatNumber(summary.utilization_pct, "%")}
                </div>
              </div>
              <div>
                {tooltipLabel(
                  "Idle Ratio",
                  "Percentage of total route duration spent idle."
                )}
                <div className="text-lg font-semibold">
                  {formatNumber(summary.idle_ratio_pct, "%")}
                </div>
              </div>
              <div>
                {tooltipLabel(
                  "Avg Moving Speed",
                  "Average speed while moving; excludes stopped and idle periods."
                )}
                <div className="text-lg font-semibold">
                  {formatNumber(summary.avg_moving_speed_kmh, " km/h")}
                </div>
              </div>
              <div>
                {tooltipLabel(
                  "Stop Completion",
                  "Completed stops versus planned stops on this route."
                )}
                <div className="text-lg font-semibold">
                  {summary.completed_stops}/{summary.planned_stops}
                </div>
                <div className="text-xs text-muted-foreground">
                  On-time {summary.on_time_stops}, late {summary.late_stops}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="text-sm font-medium">Return To Collection</div>
              <div className="text-xs text-muted-foreground">
                {stats.return_to_collection.collection_point_name ?? "Collection point not set"}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  {tooltipLabel(
                    "Return Distance",
                    "Distance traveled from last route stop back to collection point."
                  )}
                  <div className="font-semibold">
                    {formatNumber(stats.return_to_collection.return_leg_distance_km, " km")}
                  </div>
                </div>
                <div>
                  {tooltipLabel(
                    "Return Duration",
                    "Elapsed duration for the return leg."
                  )}
                  <div className="font-semibold">
                    {formatNumber(stats.return_to_collection.return_leg_duration_min, " min")}
                  </div>
                </div>
                <div>
                  {tooltipLabel(
                    "Return Avg Speed",
                    "Average speed measured during the return leg."
                  )}
                  <div className="font-semibold">
                    {formatNumber(stats.return_to_collection.return_leg_avg_speed_kmh, " km/h")}
                  </div>
                </div>
                <div>
                  {tooltipLabel(
                    "Returned",
                    "Whether telemetry indicates this run returned to the collection point."
                  )}
                  <div className="font-semibold">
                    {stats.return_to_collection.returned_to_collection ? "Yes" : "No"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="text-sm font-medium">Time Breakdown</div>
              <div className="space-y-2">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span>Driving</span>
                    <span>{formatNumber(breakdown.driving_pct, "%")}</span>
                  </div>
                  <div className="h-2 rounded bg-muted">
                    <div className="h-2 rounded bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, breakdown.driving_pct))}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span>Idle</span>
                    <span>{formatNumber(breakdown.idle_pct, "%")}</span>
                  </div>
                  <div className="h-2 rounded bg-muted">
                    <div className="h-2 rounded bg-amber-500" style={{ width: `${Math.min(100, Math.max(0, breakdown.idle_pct))}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span>Stopped</span>
                    <span>{formatNumber(breakdown.stopped_pct, "%")}</span>
                  </div>
                  <div className="h-2 rounded bg-muted">
                    <div className="h-2 rounded bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, breakdown.stopped_pct))}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="text-sm font-medium">Benchmarks</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Driver avg return distance</span>
                  <span>{formatNumber(averages.driver_last_10_routes.avg_return_distance_km, " km")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Same route avg return distance</span>
                  <span>{formatNumber(averages.same_route_last_30_days.avg_return_distance_km, " km")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fleet avg return distance</span>
                  <span>{formatNumber(averages.fleet_last_30_days.avg_return_distance_km, " km")}</span>
                </div>
              </div>
              <div className="border-t pt-3 text-xs text-muted-foreground">
                Delta vs driver: {formatNumber(deltas.vs_driver_avg_return_distance_km, " km")} | Delta vs route:{" "}
                {formatNumber(deltas.vs_route_avg_return_distance_km, " km")} | Delta vs fleet:{" "}
                {formatNumber(deltas.vs_fleet_avg_return_distance_km, " km")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="text-sm font-medium">Route Timeline</div>
              <div className="space-y-2">
                {timeline.map((segment) => (
                  <div key={segment.segment} className="rounded-md border border-border/60 p-3 text-sm">
                    <div className="font-medium capitalize">{segment.segment.replaceAll("_", " ")}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatNumber(segment.distance_km, " km")} • {formatNumber(segment.duration_min, " min")} • idle{" "}
                      {formatNumber(segment.idle_min, " min")}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  )
}
