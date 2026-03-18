"use client"

import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { isApiErrorResponse } from "@/lib/api/client"
import { listShipments } from "@/lib/api/shipments"
import { formatAddress } from "@/lib/address"
import { cn } from "@/lib/utils"
import type { Shipment } from "@/lib/types"

type ShipmentOption = {
  value: string
  label: string
}

function buildShipmentLabel(shipment: Shipment) {
  const pickupLocation = shipment.pickup_location ?? shipment.pickup_address
  const dropoffLocation = shipment.dropoff_location ?? shipment.dropoff_address
  const pickup = pickupLocation?.name ?? formatAddress(pickupLocation)
  const dropoff = dropoffLocation?.name ?? formatAddress(dropoffLocation)
  const route = [pickup, dropoff].filter(Boolean).join(" → ")
  const orderRef = shipment.merchant_order_ref ?? shipment.shipment_id
  return route ? `${orderRef} • ${route}` : orderRef
}

export function ShipmentCombobox({
  value,
  onChange,
  token,
  merchantId,
  placeholder = "Search shipments...",
  disabled = false,
}: {
  value?: string
  onChange: (value: string) => void
  token?: string | null
  merchantId?: string
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [options, setOptions] = React.useState<ShipmentOption[]>([])
  const [selectedLabel, setSelectedLabel] = React.useState("")

  React.useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setOptions([])
      setError(null)
      return
    }
    const timeoutId = window.setTimeout(async () => {
      setLoading(true)
      const response = await listShipments(token, {
        merchant_order_ref: trimmed,
        merchant_id: merchantId,
      })
      if (isApiErrorResponse(response)) {
        setError(response.message)
        setOptions([])
      } else {
        const nextOptions = (response.data ?? []).map((shipment) => ({
          value: shipment.shipment_id,
          label: buildShipmentLabel(shipment),
        }))
        setOptions(nextOptions)
        setError(null)
      }
      setLoading(false)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [merchantId, open, query, token])

  const displayLabel = selectedLabel || value || "Select shipment"

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
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {displayLabel}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-2" align="start">
        <div className="space-y-2">
          <Input
            placeholder={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {loading ? (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              Searching shipments...
            </div>
          ) : null}
          {error ? (
            <div className="px-2 py-1 text-xs text-destructive">{error}</div>
          ) : null}
          <div className="max-h-56 overflow-y-auto rounded-md border">
            {options.length === 0 && !loading ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {query.trim().length < 2
                  ? "Type at least 2 characters to search."
                  : "No shipments found."}
              </div>
            ) : null}
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setSelectedLabel(option.label)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="truncate">{option.label}</span>
                {value === option.value ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
