"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { TrackingProviderVehiclePreview, VehicleType } from "@/lib/types"

type VehicleFilters = {
  search: string
  plate_number: string
  description: string
  make: string
  model: string
}

const EMPTY_FILTERS: VehicleFilters = {
  search: "",
  plate_number: "",
  description: "",
  make: "",
  model: "",
}

function matchesFilter(value: string | null | undefined, filter: string) {
  if (!filter.trim()) return true
  return (value ?? "").toLowerCase().includes(filter.trim().toLowerCase())
}

export function TrackingProviderVehicleImportTable({
  vehicles,
  selectedIds,
  selectedVehicleTypeIds,
  vehicleTypes,
  onSelectionChange,
  onVehicleTypeChange,
}: {
  vehicles: TrackingProviderVehiclePreview[]
  selectedIds: string[]
  selectedVehicleTypeIds: Record<string, string>
  vehicleTypes: VehicleType[]
  onSelectionChange: (vehicleIds: string[]) => void
  onVehicleTypeChange: (providerVehicleId: string, vehicleTypeId: string) => void
}) {
  const [filters, setFilters] = React.useState<VehicleFilters>(EMPTY_FILTERS)

  const filteredVehicles = React.useMemo(() => {
    return vehicles.filter((vehicle) => {
      const searchable = [
        vehicle.plate_number ?? "",
        vehicle.description ?? "",
        vehicle.make ?? "",
        vehicle.model ?? "",
      ]
        .join(" ")
        .toLowerCase()

      if (filters.search.trim() && !searchable.includes(filters.search.trim().toLowerCase())) {
        return false
      }

      return (
        matchesFilter(vehicle.plate_number, filters.plate_number) &&
        matchesFilter(vehicle.description, filters.description) &&
        matchesFilter(vehicle.make, filters.make) &&
        matchesFilter(vehicle.model, filters.model)
      )
    })
  }, [filters, vehicles])

  const selectedIdSet = React.useMemo(() => new Set(selectedIds), [selectedIds])
  const visibleIds = React.useMemo(
    () => filteredVehicles.map((vehicle) => vehicle.provider_vehicle_id),
    [filteredVehicles]
  )
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((vehicleId) => selectedIdSet.has(vehicleId))
  const someVisibleSelected =
    visibleIds.length > 0 && visibleIds.some((vehicleId) => selectedIdSet.has(vehicleId))

  const updateFilter =
    (key: keyof VehicleFilters) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, [key]: event.target.value }))
    }

  const toggleVehicle = (vehicleId: string, checked: boolean) => {
    const next = new Set(selectedIdSet)
    if (checked) {
      next.add(vehicleId)
    } else {
      next.delete(vehicleId)
    }
    onSelectionChange(Array.from(next))
  }

  const toggleAllVisible = (checked: boolean) => {
    const next = new Set(selectedIdSet)
    visibleIds.forEach((vehicleId) => {
      if (checked) {
        next.add(vehicleId)
      } else {
        next.delete(vehicleId)
      }
    })
    onSelectionChange(Array.from(next))
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          value={filters.search}
          onChange={updateFilter("search")}
          placeholder="Search vehicles"
        />
        <div className="text-sm text-muted-foreground md:text-right">
          Showing {filteredVehicles.length} of {vehicles.length} vehicles
        </div>
        <Input
          value={filters.plate_number}
          onChange={updateFilter("plate_number")}
          placeholder="Filter by registration"
        />
        <Input
          value={filters.description}
          onChange={updateFilter("description")}
          placeholder="Filter by description"
        />
        <Input value={filters.make} onChange={updateFilter("make")} placeholder="Filter by make" />
        <Input value={filters.model} onChange={updateFilter("model")} placeholder="Filter by model" />
      </div>

      <div className="rounded-md border">
        <div className="max-h-[420px] overflow-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(node) => {
                      if (node) {
                        node.indeterminate = !allVisibleSelected && someVisibleSelected
                      }
                    }}
                    onChange={(event) => toggleAllVisible(event.target.checked)}
                    aria-label="Select all vehicles"
                  />
                </TableHead>
                <TableHead>Registration</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Make</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Vehicle Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    No vehicles match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredVehicles.map((vehicle) => (
                  <TableRow key={vehicle.provider_vehicle_id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIdSet.has(vehicle.provider_vehicle_id)}
                        onChange={(event) =>
                          toggleVehicle(vehicle.provider_vehicle_id, event.target.checked)
                        }
                        aria-label={`Select ${vehicle.plate_number ?? vehicle.description ?? vehicle.provider_vehicle_id}`}
                      />
                    </TableCell>
                    <TableCell>{vehicle.plate_number || "-"}</TableCell>
                    <TableCell>{vehicle.description || "-"}</TableCell>
                    <TableCell>{vehicle.make || "-"}</TableCell>
                    <TableCell>{vehicle.model || "-"}</TableCell>
                    <TableCell className="min-w-[220px]">
                      <Select
                        value={selectedVehicleTypeIds[vehicle.provider_vehicle_id] ?? ""}
                        onValueChange={(value) =>
                          onVehicleTypeChange(vehicle.provider_vehicle_id, value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle type" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicleTypes.map((vehicleType) => {
                            const vehicleTypeId = vehicleType.vehicle_type_id ?? vehicleType.uuid
                            if (!vehicleTypeId) return null

                            return (
                              <SelectItem key={vehicleTypeId} value={vehicleTypeId}>
                                {vehicleType.name}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
