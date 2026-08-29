"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  className,
}: {
  value?: DateRange
  onChange?: (range?: DateRange) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<DateRange | undefined>(value)
  const valueFrom = value?.from?.getTime()
  const valueTo = value?.to?.getTime()

  React.useEffect(() => {
    setDraft({
      from: valueFrom === undefined ? undefined : new Date(valueFrom),
      to: valueTo === undefined ? undefined : new Date(valueTo),
    })
  }, [valueFrom, valueTo])

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft({
        from: valueFrom === undefined ? undefined : new Date(valueFrom),
        to: valueTo === undefined ? undefined : new Date(valueTo),
      })
    }
    setOpen(nextOpen)
  }

  const handleClear = () => {
    setDraft(undefined)
    onChange?.(undefined)
    setOpen(false)
  }

  const handleApply = () => {
    if (!draft?.from) return
    onChange?.({ from: draft.from, to: draft.to ?? draft.from })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !value?.from && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value?.from ? (
            value.to ? (
              <>
                {format(value.from, "LLL dd, y")} - {format(value.to, "LLL dd, y")}
              </>
            ) : (
              format(value.from, "LLL dd, y")
            )
          ) : (
            placeholder
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          defaultMonth={draft?.from}
          selected={draft}
          onSelect={setDraft}
          numberOfMonths={2}
          showOutsideDays={false}
        />
        <div className="flex items-center justify-end gap-2 border-t p-3">
          <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
            Clear
          </Button>
          <Button type="button" size="sm" disabled={!draft?.from} onClick={handleApply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
