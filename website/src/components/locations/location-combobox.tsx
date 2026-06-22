"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { LocationDialog } from "@/components/locations/location-dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import { listLocations } from "@/lib/api/locations"
import { formatAddress } from "@/lib/address"
import { cn } from "@/lib/utils"
import type { Location } from "@/lib/types"

function getLocationTitle(location?: Location | null) {
  if (!location) return ""
  return location.name || location.company || location.code || formatAddress(location)
}

function getLocationSubtitle(location?: Location | null) {
  if (!location) return ""
  const address = formatAddress(location)
  const title = getLocationTitle(location)
  return address && address !== title ? address : ""
}

export function LocationCombobox({
  value,
  onChange,
  merchantId,
  placeholder = "Select location",
  searchPlaceholder = "Search locations...",
  disabled,
}: {
  value?: Location | null
  onChange: (location: Location) => void
  merchantId?: string | null
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [locations, setLocations] = React.useState<Location[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open || !merchantId) return

    let cancelled = false
    const timeoutId = window.setTimeout(async () => {
      setLoading(true)
      const response = await listLocations(undefined, {
        merchant_id: merchantId,
        search: query.trim() || undefined,
        per_page: 25,
      })
      if (cancelled) return
      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Failed to load locations.")
        setLocations([])
        setLoading(false)
        return
      }
      setLocations(response.data ?? [])
      setLoading(false)
    }, query.trim() ? 250 : 0)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [merchantId, open, query])

  const options = React.useMemo(() => {
    if (!value?.location_id) return locations
    const hasSelected = locations.some(
      (location) => location.location_id === value.location_id
    )
    return hasSelected ? locations : [value, ...locations]
  }, [locations, value])

  const selectedLabel = getLocationTitle(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || !merchantId}
          className="h-auto min-h-10 w-full justify-between whitespace-normal text-left font-normal"
        >
          <span className={cn("line-clamp-2", !selectedLabel && "text-muted-foreground")}>
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
          />
          <CommandList className="max-h-72 overflow-y-auto overscroll-contain">
            <CommandEmpty>
              {loading ? "Loading locations..." : "No locations found."}
            </CommandEmpty>
            {options.map((location) => {
              if (!location.location_id) return null
              const title = getLocationTitle(location)
              const subtitle = getLocationSubtitle(location)
              const selected = value?.location_id === location.location_id

              return (
                <CommandItem
                  key={location.location_id}
                  value={location.location_id}
                  onSelect={() => {
                    onChange(location)
                    setOpen(false)
                  }}
                  className="items-start"
                >
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      selected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{title}</span>
                    {subtitle ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {subtitle}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              )
            })}
          </CommandList>
          <CommandSeparator />
          <div className="p-1">
            <LocationDialog
              merchantId={merchantId}
              onSaved={(location) => {
                onChange(location)
                setLocations((current) => [
                  location,
                  ...current.filter(
                    (item) => item.location_id !== location.location_id
                  ),
                ])
                setOpen(false)
              }}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={!merchantId}
                >
                  <Plus className="size-4" />
                  Add new location
                </Button>
              }
            />
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
