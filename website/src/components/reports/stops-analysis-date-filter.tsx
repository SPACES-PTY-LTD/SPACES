"use client"

import { format, parseISO } from "date-fns"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { DateRangePicker } from "@/components/common/date-range-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { stopAnalysisPeriods, type StopAnalysisPeriod } from "./stops-analysis-period"

export function StopsAnalysisDateFilter({ period, from, to }: {
  period: StopAnalysisPeriod
  from?: string
  to?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(params: URLSearchParams) {
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Select value={period} onValueChange={value => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("period", value)
        params.delete("from")
        params.delete("to")
        navigate(params)
      }}>
        <SelectTrigger className="w-full sm:w-[180px]" aria-label="Stops analysis date period">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {stopAnalysisPeriods.map(option => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {period === "custom" ? (
        <DateRangePicker
          value={from || to ? { from: from ? parseISO(from) : undefined, to: to ? parseISO(to) : undefined } : undefined}
          placeholder="Select custom date range"
          className="w-full sm:w-[280px]"
          onChange={range => {
            const params = new URLSearchParams(searchParams.toString())
            params.set("period", "custom")
            if (range?.from) params.set("from", format(range.from, "yyyy-MM-dd"))
            else params.delete("from")
            if (range?.to) params.set("to", format(range.to, "yyyy-MM-dd"))
            else params.delete("to")
            navigate(params)
          }}
        />
      ) : null}
    </div>
  )
}
