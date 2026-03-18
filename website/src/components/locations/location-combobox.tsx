"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { isApiErrorResponse } from "@/lib/api/client"
import { listLocations } from "@/lib/api/locations"
import { cn } from "@/lib/utils"

type LocationOption = {
  value: string
  label: string
}

function buildLocationLabel(location: {
  location_id: string
  name?: string
  company?: string
  code?: string
  city?: string | null
}) {
  const title = (location.name!='' ? location.name: null) ?? location.company ?? location.code ?? location.location_id
  const context = [location.code, location.city].filter(Boolean).join(" • ")
  return context ? `${title} (${context})` : title
}

export function LocationCombobox({
  value,
  selectedLabel,
  onChange,
  token,
  merchantId,
  placeholder = "Search locations...",
  disabled = false,
}: {
  value?: string
  selectedLabel?: string
  onChange: (option: LocationOption) => void
  token?: string | null
  merchantId?: string
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [options, setOptions] = React.useState<LocationOption[]>([])

  React.useEffect(() => {
    if (!open) return
    const timeoutId = window.setTimeout(async () => {
      const trimmed = query.trim()
      if (trimmed.length < 2) {
        setOptions([])
        setError(null)
        return
      }

      setLoading(true)
      const response = await listLocations(token, {
        merchant_id: merchantId,
        search: trimmed,
        page: 1,
        per_page: 20,
      })

      if (isApiErrorResponse(response)) {
        setError(response.message)
        setOptions([])
      } else {
        const nextOptions = (response.data ?? []).map((location) => ({
          value: location.location_id,
          label: buildLocationLabel(location),
        }))
        setOptions(nextOptions)
        setError(null)
      }
      setLoading(false)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [merchantId, open, query, token])

  const displayLabel = selectedLabel || value || "Select location"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {loading ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Searching locations...
              </div>
            ) : null}
            {error ? (
              <div className="px-3 py-2 text-xs text-destructive">{error}</div>
            ) : null}
            {!loading && !error ? (
              <CommandEmpty>
                {query.trim().length < 2
                  ? "Type at least 2 characters to search."
                  : "No locations found."}
              </CommandEmpty>
            ) : null}
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.value} ${option.label}`}
                  onSelect={() => {
                    onChange(option)
                    setOpen(false)
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {value === option.value ? <Check className="ml-auto h-4 w-4 text-primary" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
