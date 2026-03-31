"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { type DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const DATE_RANGES = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "This week", value: "thisweek" },
  { label: "1 week", value: "1week" },
  { label: "2 weeks", value: "2weeks" },
  { label: "30 days", value: "30days" },
  { label: "1 month", value: "1month" },
  { label: "3 months", value: "3months" },
  { label: "6 months", value: "6months" },
  { label: "1 year", value: "1year" },
  { label: "All time", value: "alltime" },
  { label: "Custom", value: "custom" },
] as const

const LOCATION_TYPES = [
  { label: "Pickup locations", value: "pickup" },
  { label: "Dropoff locations", value: "dropoff" },
] as const

export function ShipmentsByLocationControls({
  dateRange,
  locationType,
  startDate,
  endDate,
}: {
  dateRange: string
  locationType: "pickup" | "dropoff"
  startDate?: string
  endDate?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function formatDate(date?: Date) {
    return date ? format(date, "yyyy-MM-dd") : undefined
  }

  const selectedRange = React.useMemo<DateRange | undefined>(() => {
    const from = startDate ? parseISO(startDate) : undefined
    const to = endDate ? parseISO(endDate) : undefined

    if (!from && !to) return undefined

    return {
      from,
      to,
    }
  }, [endDate, startDate])

  const [date, setDate] = React.useState<DateRange | undefined>(selectedRange)

  React.useEffect(() => {
    setDate(selectedRange)
  }, [selectedRange])

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <div className="inline-flex rounded-md border border-border bg-background p-1">
        {LOCATION_TYPES.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => updateParams({ location_type: option.value })}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm transition-colors",
              locationType === option.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Select
        value={dateRange}
        onValueChange={(value) =>
          updateParams({
            date_range: value,
            start_date: value === "custom" ? startDate : undefined,
            end_date: value === "custom" ? endDate : undefined,
          })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Date range" />
        </SelectTrigger>
        <SelectContent>
          {DATE_RANGES.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {dateRange === "custom" ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start px-2.5 text-left font-normal sm:w-[280px]"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} -{" "}
                    {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-0">
              <Calendar
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
                showOutsideDays={false}
                disabled={{ after: new Date() }}
              />
              <div className="flex items-center justify-end gap-2 border-t p-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDate(undefined)
                    updateParams({
                      start_date: undefined,
                      end_date: undefined,
                    })
                  }}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!date?.from || !date?.to}
                  onClick={() =>
                    updateParams({
                      start_date: formatDate(date?.from),
                      end_date: formatDate(date?.to),
                    })
                  }
                >
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}
