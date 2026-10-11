import { subMonths } from "date-fns"

export const stopAnalysisPeriods = [
  { value: "24h", label: "Last 24hrs" },
  { value: "48h", label: "Last 48hrs" },
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 2 weeks" },
  { value: "1m", label: "Last month" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "custom", label: "Custom" },
] as const

export type StopAnalysisPeriod = typeof stopAnalysisPeriods[number]["value"]

export function normalizeStopAnalysisPeriod(value: string, hasCustomDates: boolean): StopAnalysisPeriod {
  return stopAnalysisPeriods.some(period => period.value === value)
    ? value as StopAnalysisPeriod
    : hasCustomDates ? "custom" : "24h"
}

export function stopAnalysisPeriodBounds(period: StopAnalysisPeriod, now: Date) {
  if (period === "custom") return {}
  const hours = { "24h": 24, "48h": 48, "7d": 168, "14d": 336 }
  const months = { "1m": 1, "3m": 3, "6m": 6 }
  const start = period in hours
    ? new Date(now.getTime() - hours[period as keyof typeof hours] * 3_600_000)
    : subMonths(now, months[period as keyof typeof months])
  return { occurred_from: start.toISOString(), occurred_to: now.toISOString() }
}
