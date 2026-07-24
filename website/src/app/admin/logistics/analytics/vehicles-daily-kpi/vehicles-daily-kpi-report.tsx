"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { VehicleDailyKpiRow } from "@/lib/api/reports"

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
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = React.useTransition()
  const [currentYear, currentMonth] = currentLocalDate.split("-").map(Number)

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

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-30 w-44 min-w-44 border-b border-r bg-muted px-3 py-2" />
              <th className="sticky left-44 z-30 w-72 min-w-72 border-b border-r bg-muted px-3 py-2 text-center font-semibold">
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
                <th className="sticky left-44 z-20 w-72 min-w-72 border-b border-r bg-card px-3 py-1.5 text-left font-normal">
                  {label}
                </th>
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const value = vehicle.days[String(index + 1)]?.[key] ?? 0
                  return (
                    <td key={index + 1} className="h-8 min-w-10 border-b border-r px-2 text-center tabular-nums">
                      {value > 0 ? value : ""}
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
    </div>
  )
}
