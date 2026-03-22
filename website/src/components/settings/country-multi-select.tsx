"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getCountryOptions } from "@/lib/geo-options"
import { cn } from "@/lib/utils"

export function CountryMultiSelect({
  value,
  onChange,
  triggerLabel = "Select a country",
  searchPlaceholder = "Search countries...",
  emptyMessage = "No country found.",
}: {
  value: string[]
  onChange: (value: string[]) => void
  triggerLabel?: string
  searchPlaceholder?: string
  emptyMessage?: string
}) {
  const [open, setOpen] = React.useState(false)

  const countryOptions = React.useMemo(() => getCountryOptions(), [])
  const countryByCode = React.useMemo(
    () => new Map(countryOptions.map((country) => [country.code, country] as const)),
    [countryOptions]
  )

  const selectedCountries = React.useMemo(
    () =>
      value.map((code) => {
        const option = countryByCode.get(code)
        return option ?? { code, name: code }
      }),
    [countryByCode, value]
  )

  const addCountry = (code: string) => {
    if (value.includes(code)) return
    onChange([...value, code])
  }

  const removeCountry = (code: string) => {
    onChange(value.filter((entry) => entry !== code))
  }

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {triggerLabel}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              {countryOptions.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.name} ${country.code}`}
                  onSelect={() => {
                    addCountry(country.code)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.includes(country.code) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {country.name}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="flex flex-wrap gap-2">
        {selectedCountries.map((country) => (
          <div
            key={country.code}
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary"
          >
            {country.name}
            <button
              type="button"
              aria-label={`Remove ${country.name}`}
              onClick={() => removeCountry(country.code)}
              className="rounded-full p-0.5 hover:bg-primary/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
