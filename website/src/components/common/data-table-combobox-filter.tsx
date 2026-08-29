"use client"

import * as React from "react"
import { Check, ChevronsUpDown, LoaderCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
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
import { formatAddress } from "@/lib/address"
import { isApiErrorResponse } from "@/lib/api/client"
import { getDriver, listDrivers } from "@/lib/api/drivers"
import { getLocation, listLocations } from "@/lib/api/locations"
import { cn } from "@/lib/utils"
import type { Driver, Location } from "@/lib/types"

export type DataTableComboboxResource = "locations" | "drivers"

type ComboboxOption = {
  value: string
  label: string
  description?: string
}

function locationOption(location: Location): ComboboxOption {
  const address = formatAddress(location)
  const primary = location.name || location.company || location.code || address || location.location_id
  const label = location.code && location.code !== primary
    ? `${primary} (${location.code})`
    : primary

  return {
    value: location.location_id,
    label,
    description: address && address !== label ? address : undefined,
  }
}

function driverOption(driver: Driver): ComboboxOption {
  const label = driver.name || driver.email || driver.driver_id

  return {
    value: driver.driver_id,
    label,
    description: driver.email && driver.email !== label ? driver.email : undefined,
  }
}

async function loadOptions({
  resource,
  accessToken,
  merchantId,
  query,
}: {
  resource: DataTableComboboxResource
  accessToken?: string | null
  merchantId: string
  query: string
}) {
  if (resource === "locations") {
    const response = await listLocations(accessToken, {
      merchant_id: merchantId,
      search: query || undefined,
      per_page: 25,
      sort_by: "name",
      sort_dir: "asc",
    })

    if (isApiErrorResponse(response)) {
      return { options: [], error: response.message || "Failed to load locations." }
    }

    return { options: (response.data ?? []).map(locationOption), error: null }
  }

  const response = await listDrivers(accessToken, {
    merchant_id: merchantId,
    search: query || undefined,
    per_page: 25,
    sort_by: "name",
    sort_direction: "asc",
  })

  if (isApiErrorResponse(response)) {
    return { options: [], error: response.message || "Failed to load drivers." }
  }

  return { options: (response.data ?? []).map(driverOption), error: null }
}

async function loadSelectedOption({
  resource,
  value,
  accessToken,
  merchantId,
}: {
  resource: DataTableComboboxResource
  value: string
  accessToken?: string | null
  merchantId: string
}): Promise<ComboboxOption | null> {
  if (resource === "locations") {
    const response = await getLocation(value, accessToken, { merchant_id: merchantId })
    return isApiErrorResponse(response) ? null : locationOption(response)
  }

  const response = await getDriver(value, accessToken, { merchant_id: merchantId })
  return isApiErrorResponse(response) ? null : driverOption(response)
}

export function DataTableComboboxFilter({
  label,
  value,
  onValueChange,
  resource,
  accessToken,
  merchantId,
  placeholder,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  resource: DataTableComboboxResource
  accessToken?: string | null
  merchantId?: string | null
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [options, setOptions] = React.useState<ComboboxOption[]>([])
  const [selectedOption, setSelectedOption] = React.useState<ComboboxOption | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const resourceLabel = resource === "locations" ? "locations" : "drivers"

  React.useEffect(() => {
    if (!value) {
      setSelectedOption(null)
      return
    }

    if (!merchantId) return

    let cancelled = false
    loadSelectedOption({ resource, value, accessToken, merchantId }).then((result) => {
      if (!cancelled) setSelectedOption(result)
    })

    return () => {
      cancelled = true
    }
  }, [accessToken, merchantId, resource, value])

  React.useEffect(() => {
    if (!open || !merchantId) return

    let cancelled = false
    const trimmedQuery = query.trim()
    const timeoutId = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      setOptions([])

      const result = await loadOptions({
        resource,
        accessToken,
        merchantId,
        query: trimmedQuery,
      })

      if (cancelled) return
      setOptions(result.options)
      setError(result.error)
      setLoading(false)
    }, trimmedQuery ? 250 : 0)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [accessToken, merchantId, open, query, resource])

  const displayLabel = selectedOption?.value === value ? selectedOption.label : value

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          disabled={!merchantId}
          className="h-9 w-[220px] justify-between border-dashed px-3 font-normal"
        >
          <span className={cn("truncate", !displayLabel && "text-muted-foreground")}>
            {displayLabel ? `${label}: ${displayLabel}` : (placeholder ?? label)}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={`Search ${resourceLabel}...`}
          />
          <CommandList aria-busy={loading}>
            <CommandItem
              value={`clear-${resource}`}
              onSelect={() => {
                setSelectedOption(null)
                onValueChange("")
                setOpen(false)
                setQuery("")
              }}
            >
              <X className="size-4" />
              All {resourceLabel}
            </CommandItem>
            <CommandSeparator />

            {loading ? (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground" role="status">
                <LoaderCircle className="size-4 animate-spin" />
                Loading {resourceLabel}...
              </div>
            ) : error ? (
              <div className="px-3 py-6 text-sm text-destructive" role="alert">
                {error}
              </div>
            ) : options.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No {resourceLabel} found.
              </div>
            ) : (
              options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    setSelectedOption(option)
                    onValueChange(option.value)
                    setOpen(false)
                    setQuery("")
                  }}
                  className="items-start"
                >
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      option.value === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.description ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
