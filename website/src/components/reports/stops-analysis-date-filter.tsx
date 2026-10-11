"use client"

import { format, parseISO } from "date-fns"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { DateRangePicker } from "@/components/common/date-range-picker"

export function StopsAnalysisDateFilter({ from, to }: { from?: string; to?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return <DateRangePicker
    value={from || to ? { from: from ? parseISO(from) : undefined, to: to ? parseISO(to) : undefined } : undefined}
    placeholder="Filter by date range"
    className="w-full sm:w-[280px]"
    onChange={range => {
      const params = new URLSearchParams(searchParams.toString())
      if (range?.from) params.set("from", format(range.from, "yyyy-MM-dd"))
      else params.delete("from")
      if (range?.to) params.set("to", format(range.to, "yyyy-MM-dd"))
      else params.delete("to")
      params.delete("page")
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    }}
  />
}
