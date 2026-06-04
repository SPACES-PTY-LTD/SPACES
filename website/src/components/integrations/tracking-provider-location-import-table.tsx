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
import type { TrackingProviderLocationPreview } from "@/lib/types"

type LocationFilters = {
  search: string
  name: string
  code: string
  company: string
  address: string
  city: string
  province: string
  country: string
  geofence: "all" | "with" | "without"
}

const EMPTY_FILTERS: LocationFilters = {
  search: "",
  name: "",
  code: "",
  company: "",
  address: "",
  city: "",
  province: "",
  country: "",
  geofence: "all",
}

function matchesFilter(value: string | null | undefined, filter: string) {
  if (!filter.trim()) return true
  return (value ?? "").toLowerCase().includes(filter.trim().toLowerCase())
}

export function TrackingProviderLocationImportTable({
  locations,
  selectedIds,
  onSelectionChange,
}: {
  locations: TrackingProviderLocationPreview[]
  selectedIds: string[]
  onSelectionChange: (locationIds: string[]) => void
}) {
  const [filters, setFilters] = React.useState<LocationFilters>(EMPTY_FILTERS)

  const filteredLocations = React.useMemo(() => {
    return locations.filter((location) => {
      const searchable = [
        location.provider_location_id,
        location.name ?? "",
        location.code ?? "",
        location.company ?? "",
        location.full_address ?? "",
        location.city ?? "",
        location.province ?? "",
        location.country ?? "",
      ]
        .join(" ")
        .toLowerCase()

      if (filters.search.trim() && !searchable.includes(filters.search.trim().toLowerCase())) {
        return false
      }

      if (filters.geofence === "with" && !location.has_geofence) {
        return false
      }

      if (filters.geofence === "without" && location.has_geofence) {
        return false
      }

      return (
        matchesFilter(location.name, filters.name) &&
        matchesFilter(location.code, filters.code) &&
        matchesFilter(location.company, filters.company) &&
        matchesFilter(location.full_address, filters.address) &&
        matchesFilter(location.city, filters.city) &&
        matchesFilter(location.province, filters.province) &&
        matchesFilter(location.country, filters.country)
      )
    })
  }, [filters, locations])

  const selectedIdSet = React.useMemo(() => new Set(selectedIds), [selectedIds])
  const visibleIds = React.useMemo(
    () => filteredLocations.map((location) => location.provider_location_id),
    [filteredLocations]
  )
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((locationId) => selectedIdSet.has(locationId))
  const someVisibleSelected =
    visibleIds.length > 0 && visibleIds.some((locationId) => selectedIdSet.has(locationId))

  const updateFilter =
    (key: Exclude<keyof LocationFilters, "geofence">) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, [key]: event.target.value }))
    }

  const toggleLocation = (locationId: string, checked: boolean) => {
    const next = new Set(selectedIdSet)
    if (checked) {
      next.add(locationId)
    } else {
      next.delete(locationId)
    }
    onSelectionChange(Array.from(next))
  }

  const toggleAllVisible = (checked: boolean) => {
    const next = new Set(selectedIdSet)
    visibleIds.forEach((locationId) => {
      if (checked) {
        next.add(locationId)
      } else {
        next.delete(locationId)
      }
    })
    onSelectionChange(Array.from(next))
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Input
          value={filters.search}
          onChange={updateFilter("search")}
          placeholder="Search locations"
        />
        <div className="text-sm text-muted-foreground md:text-right xl:col-span-2">
          Showing {filteredLocations.length} of {locations.length} locations
        </div>
        <Input value={filters.name} onChange={updateFilter("name")} placeholder="Filter by name" />
        <Input value={filters.code} onChange={updateFilter("code")} placeholder="Filter by code" />
        <Input
          value={filters.company}
          onChange={updateFilter("company")}
          placeholder="Filter by company"
        />
        <Input
          value={filters.address}
          onChange={updateFilter("address")}
          placeholder="Filter by address"
        />
        <Input value={filters.city} onChange={updateFilter("city")} placeholder="Filter by city" />
        <Input
          value={filters.province}
          onChange={updateFilter("province")}
          placeholder="Filter by province"
        />
        <Input
          value={filters.country}
          onChange={updateFilter("country")}
          placeholder="Filter by country"
        />
        <Select
          value={filters.geofence}
          onValueChange={(value: LocationFilters["geofence"]) =>
            setFilters((prev) => ({ ...prev, geofence: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by geofence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All geofences</SelectItem>
            <SelectItem value="with">With geofence</SelectItem>
            <SelectItem value="without">Without geofence</SelectItem>
          </SelectContent>
        </Select>
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
                    aria-label="Select all locations"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Geofence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    No locations match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLocations.map((location) => (
                  <TableRow key={location.provider_location_id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIdSet.has(location.provider_location_id)}
                        onChange={(event) =>
                          toggleLocation(location.provider_location_id, event.target.checked)
                        }
                        aria-label={`Select ${location.name ?? location.code ?? location.provider_location_id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div>{location.name || "-"}</div>
                      <div className="text-xs text-muted-foreground">
                        {location.provider_location_id}
                      </div>
                    </TableCell>
                    <TableCell>{location.code || "-"}</TableCell>
                    <TableCell>{location.company || "-"}</TableCell>
                    <TableCell>{location.full_address || "-"}</TableCell>
                    <TableCell>
                      {[location.city, location.province, location.country].filter(Boolean).join(", ") ||
                        "-"}
                    </TableCell>
                    <TableCell>{location.has_geofence ? "Yes" : "No"}</TableCell>
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
