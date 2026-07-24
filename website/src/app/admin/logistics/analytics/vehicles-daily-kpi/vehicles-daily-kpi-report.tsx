"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import {
  getVehiclesDailyKpiEntries,
  type VehicleDailyKpiEntry,
  type VehicleDailyKpiMetrics,
  type VehicleDailyKpiRow,
  type VehiclesDailyKpiEntriesResponse,
} from "@/lib/api/reports"
import { AdminRoute } from "@/lib/routes/admin"
import Link from "next/link"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const KPI_ROWS = [
  ["speed_violations", "Speed Violation > 80km/hr (Over Speed)"],
  ["runs", "Runs"],
  ["shipments", "Shipments"],
  ["total_stops", "Total Stops"],
  ["unknown_location_stops", "Stops at Unknown Locations"],
  ["invoiced_shipments", "Invoiced Shipments"],
] as const

type Props = {
  rows: VehicleDailyKpiRow[]
  year: number
  month: number
  onlyWithData: boolean
  monthLabel: string
  daysInMonth: number
  currentLocalDate: string
  availableYears: number[]
  accessToken: string
  merchantId?: string
}

type DrilldownSelection = {
  vehicleId: string
  registration: string
  metric: keyof VehicleDailyKpiMetrics
  metricLabel: string
  day: number
}

export function VehiclesDailyKpiReport({
  rows,
  year,
  month,
  onlyWithData,
  monthLabel,
  daysInMonth,
  currentLocalDate,
  availableYears,
  accessToken,
  merchantId,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = React.useTransition()
  const [isHorizontallyScrolled, setIsHorizontallyScrolled] = React.useState(false)
  const [drilldown, setDrilldown] = React.useState<DrilldownSelection | null>(null)
  const [drilldownPage, setDrilldownPage] = React.useState(1)
  const [drilldownResponse, setDrilldownResponse] = React.useState<VehiclesDailyKpiEntriesResponse | null>(null)
  const [drilldownError, setDrilldownError] = React.useState<string | null>(null)
  const [drilldownLoading, setDrilldownLoading] = React.useState(false)
  const [currentYear, currentMonth] = currentLocalDate.split("-").map(Number)
  const frozenEdgeShadow = isHorizontallyScrolled
    ? "shadow-[8px_0_10px_-8px_rgba(0,0,0,0.45)]"
    : ""

  React.useEffect(() => {
    if (!drilldown) return
    let active = true
    setDrilldownLoading(true)
    setDrilldownError(null)

    getVehiclesDailyKpiEntries({
      merchant_id: merchantId,
      vehicle_id: drilldown.vehicleId,
      year,
      month,
      day: drilldown.day,
      metric: drilldown.metric,
      page: drilldownPage,
      per_page: 25,
    }, accessToken).then((response) => {
      if (!active) return
      if (isApiErrorResponse(response)) {
        setDrilldownResponse(null)
        setDrilldownError(response.message || "Unable to load KPI entries.")
      } else {
        setDrilldownResponse(response)
      }
      setDrilldownLoading(false)
    })

    return () => { active = false }
  }, [accessToken, drilldown, drilldownPage, merchantId, month, year])

  function openDrilldown(selection: DrilldownSelection) {
    setDrilldownPage(1)
    setDrilldownResponse(null)
    setDrilldownError(null)
    setDrilldown(selection)
  }

  function entryHref(entry: VehicleDailyKpiEntry) {
    if (entry.entry_type === "activity") return AdminRoute.vehicleActivityDetails(entry.entry_id)
    if (entry.entry_type === "shipment") return AdminRoute.shipmentDetails(entry.entry_id)
    return null
  }

  function formatDateTime(value?: string | null) {
    if (!value) return "-"
    return new Intl.DateTimeFormat("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  }

  function updateFilters(next: { year?: number; month?: number; onlyWithData?: boolean }) {
    const nextYear = next.year ?? year
    let nextMonth = next.month ?? month
    if (nextYear === currentYear && nextMonth > currentMonth) nextMonth = currentMonth

    const query = new URLSearchParams({
      year: String(nextYear),
      month: String(nextMonth),
    })
    if (next.onlyWithData ?? onlyWithData) query.set("only_with_data", "1")

    startTransition(() => router.push(`${pathname}?${query.toString()}`))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <div className="grid gap-2">
          <Label htmlFor="kpi-year">Year</Label>
          <select
            id="kpi-year"
            value={year}
            disabled={isPending}
            onChange={(event) => updateFilters({ year: Number(event.target.value) })}
            className="h-9 min-w-28 rounded-md border border-input bg-background px-3 text-sm"
          >
            {availableYears.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="kpi-month">Month</Label>
          <select
            id="kpi-month"
            value={month}
            disabled={isPending}
            onChange={(event) => updateFilters({ month: Number(event.target.value) })}
            className="h-9 min-w-36 rounded-md border border-input bg-background px-3 text-sm"
          >
            {MONTHS.map((label, index) => {
              const value = index + 1
              const disabled = year === currentYear && value > currentMonth
              return <option key={label} value={value} disabled={disabled}>{label}</option>
            })}
          </select>
        </div>
        <div className="flex h-9 items-center gap-2">
          <Switch
            id="kpi-data-only"
            checked={onlyWithData}
            disabled={isPending}
            onCheckedChange={(checked) => updateFilters({ onlyWithData: checked })}
          />
          <Label htmlFor="kpi-data-only">Only show vehicles with data</Label>
        </div>
        {isPending ? <span className="text-sm text-muted-foreground">Loading…</span> : null}
      </div>

      <div
        className="overflow-x-auto rounded-lg border bg-card"
        onScroll={(event) => setIsHorizontallyScrolled(event.currentTarget.scrollLeft > 0)}
      >
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-30 w-44 min-w-44 border-b border-r bg-muted px-3 py-2" />
              <th className={`sticky left-44 z-30 w-72 min-w-72 border-b border-r bg-muted px-3 py-2 text-center font-semibold ${frozenEdgeShadow}`}>
                {monthLabel}
              </th>
              {Array.from({ length: daysInMonth }, (_, index) => (
                <th key={index + 1} className="h-9 min-w-10 border-b border-r bg-muted px-2 text-center font-medium">
                  {index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((vehicle) => KPI_ROWS.map(([key, label], rowIndex) => (
              <tr key={`${vehicle.vehicle_id}-${key}`} className={rowIndex === 0 ? "border-t-2 border-t-foreground/50" : ""}>
                {rowIndex === 0 ? (
                  <th
                    rowSpan={KPI_ROWS.length}
                    className="sticky left-0 z-20 w-44 min-w-44 border-r bg-card px-3 py-2 text-left align-top font-semibold"
                  >
                    Reg: {vehicle.registration}
                  </th>
                ) : null}
                <th className={`sticky left-44 z-20 w-72 min-w-72 border-b border-r bg-card px-3 py-1.5 text-left font-normal ${frozenEdgeShadow}`}>
                  {label}
                </th>
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const value = vehicle.days[String(index + 1)]?.[key] ?? 0
                  return (
                    <td key={index + 1} className="h-8 min-w-10 border-b border-r px-2 text-center tabular-nums">
                      {value > 0 ? (
                        <button
                          type="button"
                          className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => openDrilldown({
                            vehicleId: vehicle.vehicle_id,
                            registration: vehicle.registration,
                            metric: key,
                            metricLabel: label,
                            day: index + 1,
                          })}
                          aria-label={`View ${value} ${label} entries for ${vehicle.registration} on day ${index + 1}`}
                        >
                          {value}
                        </button>
                      ) : ""}
                    </td>
                  )
                })}
              </tr>
            )))}
            {rows.length === 0 ? (
              <tr><td colSpan={daysInMonth + 2} className="p-8 text-center text-muted-foreground">No vehicles match this report.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(drilldown)} onOpenChange={(open) => { if (!open) setDrilldown(null) }}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{drilldown?.metricLabel}</DialogTitle>
            <DialogDescription>
              Reg: {drilldown?.registration} · {drilldownResponse?.meta?.date_label ?? `${drilldown?.day} ${monthLabel}`}
              {drilldownResponse?.meta ? ` · ${drilldownResponse.meta.total} entries` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-auto rounded-md border">
            {drilldownLoading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading entries…</div> : null}
            {drilldownError ? <div className="p-8 text-center text-sm text-destructive">{drilldownError}</div> : null}
            {!drilldownLoading && !drilldownError && drilldownResponse?.data.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No entries found.</div>
            ) : null}
            {!drilldownLoading && !drilldownError && drilldownResponse?.data.length ? (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Reference</th>
                    <th className="px-3 py-2 text-left">Date / time</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Details</th>
                    <th className="px-3 py-2 text-left">Run</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldownResponse.data.map((entry) => {
                    const href = entryHref(entry)
                    const details = entry.entry_type === "activity"
                      ? [entry.speed_kph != null ? `${entry.speed_kph} km/h` : null, entry.speed_limit_kph != null ? `limit ${entry.speed_limit_kph} km/h` : null, entry.location || "Unknown location"].filter(Boolean).join(" · ")
                      : entry.entry_type === "run"
                        ? [entry.driver || "No driver", `${entry.shipment_count ?? 0} shipments`].join(" · ")
                        : [entry.invoice_number ? `Invoice ${entry.invoice_number}` : null].filter(Boolean).join(" · ") || "-"
                    return (
                      <tr key={`${entry.entry_type}-${entry.entry_id}`} className="border-t">
                        <td className="px-3 py-2 font-medium">
                          {href ? <Link href={href} className="text-primary hover:underline">{entry.reference}</Link> : entry.reference}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{formatDateTime(entry.occurred_at)}</td>
                        <td className="px-3 py-2 capitalize">{entry.status?.replaceAll("_", " ") ?? "-"}</td>
                        <td className="px-3 py-2">{details}</td>
                        <td className="px-3 py-2 font-mono text-xs">{entry.run_id ?? "-"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : null}
          </div>

          <DialogFooter className="items-center justify-between sm:justify-between">
            <span className="text-sm text-muted-foreground">
              Page {drilldownResponse?.meta?.current_page ?? drilldownPage} of {drilldownResponse?.meta?.last_page ?? 1}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={drilldownLoading || drilldownPage <= 1} onClick={() => setDrilldownPage((page) => page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={drilldownLoading || drilldownPage >= (drilldownResponse?.meta?.last_page ?? 1)} onClick={() => setDrilldownPage((page) => page + 1)}>Next</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
