"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const DATE_RANGES = [
  { label: "1 week", value: "1week" },
  { label: "2 weeks", value: "2weeks" },
  { label: "30 days", value: "30days" },
  { label: "1 month", value: "1month" },
  { label: "3 months", value: "3months" },
  { label: "6 months", value: "6months" },
  { label: "1 year", value: "1year" },
  { label: "All time", value: "alltime" },
] as const

const LOCATION_TYPES = [
  { label: "Pickup locations", value: "pickup" },
  { label: "Dropoff locations", value: "dropoff" },
] as const

export function ShipmentsByLocationControls({
  dateRange,
  locationType,
}: {
  dateRange: string
  locationType: "pickup" | "dropoff"
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <div className="inline-flex rounded-md border border-border bg-background p-1">
        {LOCATION_TYPES.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => updateParam("location_type", option.value)}
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

      <Select value={dateRange} onValueChange={(value) => updateParam("date_range", value)}>
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
    </div>
  )
}
