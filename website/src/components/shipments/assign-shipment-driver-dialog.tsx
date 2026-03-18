"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { isApiErrorResponse } from "@/lib/api/client"
import { listDriverVehicles } from "@/lib/api/driver-vehicles"
import { listDrivers } from "@/lib/api/drivers"
import { assignShipmentDriver } from "@/lib/api/shipments"
import { cn } from "@/lib/utils"
import type { Driver, Vehicle } from "@/lib/types"

type DriverOption = {
  value: string
  label: string
}

function buildDriverLabel(driver: Driver) {
  return [driver.name, driver.email].filter(Boolean).join(" • ")
}

function buildVehicleLabel(vehicle: Vehicle) {
  const title =
    vehicle.plate_number ??
    vehicle.ref_code ??
    vehicle.vehicle_id ??
    "Unnamed vehicle"
  const description = [vehicle.make, vehicle.model].filter(Boolean).join(" ")
  return description ? `${title} • ${description}` : title
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

function toIsoDateTime(value: string) {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

export function AssignShipmentDriverDialog({
  open,
  onOpenChange,
  shipmentId,
  merchantId,
  plannedStartAt,
  hasRun,
  accessToken,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shipmentId: string
  merchantId?: string
  plannedStartAt?: string | null
  hasRun?: boolean
  accessToken?: string | null
}) {
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [selectedDriverId, setSelectedDriverId] = React.useState("")
  const [selectedDriverLabel, setSelectedDriverLabel] = React.useState("")
  const [driverOptions, setDriverOptions] = React.useState<DriverOption[]>([])
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = React.useState("")
  const [loadingDrivers, setLoadingDrivers] = React.useState(false)
  const [loadingVehicles, setLoadingVehicles] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [dateValue, setDateValue] = React.useState(toDateTimeLocal(plannedStartAt))
  const [notes, setNotes] = React.useState("")

  React.useEffect(() => {
    if (!open) return
    setQuery("")
    setSelectedDriverId("")
    setSelectedDriverLabel("")
    setDriverOptions([])
    setVehicles([])
    setSelectedVehicleId("")
    setDateValue(toDateTimeLocal(plannedStartAt))
    setNotes("")
  }, [open, plannedStartAt])

  React.useEffect(() => {
    if (!open || !pickerOpen) return
    const timeoutId = window.setTimeout(async () => {
      const trimmed = query.trim()
      if (trimmed.length < 2) {
        setDriverOptions([])
        return
      }

      setLoadingDrivers(true)
      try {
        const response = await listDrivers(accessToken, {
          merchant_id: merchantId,
          page: 1,
          per_page: 20,
          search: trimmed,
        })
        if (isApiErrorResponse(response)) {
          toast.error(response.message)
          setDriverOptions([])
          return
        }
        setDriverOptions(
          (response.data ?? []).map((driver) => ({
            value: driver.driver_id,
            label: buildDriverLabel(driver),
          }))
        )
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load drivers."
        )
      } finally {
        setLoadingDrivers(false)
      }
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [accessToken, merchantId, open, pickerOpen, query])

  React.useEffect(() => {
    if (!open || !selectedDriverId) return
    let active = true

    ;(async () => {
      setLoadingVehicles(true)
      setVehicles([])
      setSelectedVehicleId("")
      try {
        const response = await listDriverVehicles(selectedDriverId, accessToken)
        if (!active) return
        if (isApiErrorResponse(response)) {
          toast.error(response.message)
          return
        }
        setVehicles(response.data ?? [])
      } catch (error) {
        if (!active) return
        toast.error(
          error instanceof Error ? error.message : "Failed to load vehicles."
        )
      } finally {
        if (active) {
          setLoadingVehicles(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [accessToken, open, selectedDriverId])

  const handleSave = async () => {
    if (!selectedDriverId) {
      toast.error("Select a driver.")
      return
    }
    const nextPlannedStartAt = toIsoDateTime(dateValue)
    if (!hasRun && !nextPlannedStartAt) {
      toast.error("Select a planned start date.")
      return
    }

    setSaving(true)
    try {
      const result = await assignShipmentDriver(
        shipmentId,
        {
          driver_id: selectedDriverId,
          vehicle_id: selectedVehicleId || null,
          planned_start_at: nextPlannedStartAt,
          notes: notes.trim() || null,
        },
        accessToken
      )
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Driver assigned.")
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to assign driver."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign driver</DialogTitle>
          <DialogDescription>
            Select a driver, then optionally choose one of that driver&apos;s vehicles.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Driver</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="justify-between"
                >
                  <span
                    className={cn(
                      "truncate",
                      !selectedDriverId && "text-muted-foreground"
                    )}
                  >
                    {selectedDriverLabel || "Search drivers..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search drivers..."
                    value={query}
                    onValueChange={setQuery}
                  />
                  <CommandList>
                    {loadingDrivers ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Searching drivers...
                      </div>
                    ) : null}
                    {!loadingDrivers ? (
                      <CommandEmpty>
                        {query.trim().length < 2
                          ? "Type at least 2 characters to search."
                          : "No drivers found."}
                      </CommandEmpty>
                    ) : null}
                    <CommandGroup>
                      {driverOptions.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={`${option.value} ${option.label}`}
                          onSelect={() => {
                            setSelectedDriverId(option.value)
                            setSelectedDriverLabel(option.label)
                            setPickerOpen(false)
                          }}
                        >
                          <span className="truncate">{option.label}</span>
                          {selectedDriverId === option.value ? (
                            <Check className="ml-auto h-4 w-4 text-primary" />
                          ) : null}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {selectedDriverId ? (
            <div className="grid gap-2">
              <Label>Vehicle</Label>
              <Select
                value={selectedVehicleId}
                onValueChange={setSelectedVehicleId}
                disabled={loadingVehicles}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      loadingVehicles
                        ? "Loading vehicles..."
                        : vehicles.length === 0
                          ? "No vehicles found"
                          : "Select a vehicle"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => {
                    const value =
                      vehicle.vehicle_id ??
                      vehicle.vehicle_uuid ??
                      vehicle.driver_vehicle_id
                    if (!value) return null
                    return (
                      <SelectItem key={value} value={value}>
                        {buildVehicleLabel(vehicle)}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {!hasRun ? (
            <div className="grid gap-2">
              <Label htmlFor="assign-driver-planned-start-at">Planned start</Label>
              <Input
                id="assign-driver-planned-start-at"
                type="datetime-local"
                value={dateValue}
                onChange={(event) => setDateValue(event.target.value)}
              />
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="assign-driver-notes">Notes</Label>
            <Textarea
              id="assign-driver-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional notes"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
