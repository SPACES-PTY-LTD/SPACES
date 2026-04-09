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
import type { TrackingProviderDriverPreview } from "@/lib/types"

type DriverFilters = {
  search: string
  provider_driver_id: string
  name: string
  email: string
  telephone: string
  employee_number: string
  status: "all" | "active" | "inactive" | "unknown"
}

const EMPTY_FILTERS: DriverFilters = {
  search: "",
  provider_driver_id: "",
  name: "",
  email: "",
  telephone: "",
  employee_number: "",
  status: "all",
}

function matchesFilter(value: string | null | undefined, filter: string) {
  if (!filter.trim()) return true
  return (value ?? "").toLowerCase().includes(filter.trim().toLowerCase())
}

export function TrackingProviderDriverImportTable({
  drivers,
  selectedIds,
  onSelectionChange,
}: {
  drivers: TrackingProviderDriverPreview[]
  selectedIds: string[]
  onSelectionChange: (driverIds: string[]) => void
}) {
  const [filters, setFilters] = React.useState<DriverFilters>(EMPTY_FILTERS)

  const filteredDrivers = React.useMemo(() => {
    return drivers.filter((driver) => {
      const searchable = [
        driver.provider_driver_id,
        driver.name ?? "",
        driver.email ?? "",
        driver.telephone ?? "",
        driver.employee_number ?? "",
        driver.notes ?? "",
      ]
        .join(" ")
        .toLowerCase()

      if (filters.search.trim() && !searchable.includes(filters.search.trim().toLowerCase())) {
        return false
      }

      if (
        filters.status !== "all" &&
        (filters.status === "unknown"
          ? driver.is_active !== null && driver.is_active !== undefined
          : filters.status === "active"
            ? driver.is_active !== true
            : driver.is_active !== false)
      ) {
        return false
      }

      return (
        matchesFilter(driver.provider_driver_id, filters.provider_driver_id) &&
        matchesFilter(driver.name, filters.name) &&
        matchesFilter(driver.email, filters.email) &&
        matchesFilter(driver.telephone, filters.telephone) &&
        matchesFilter(driver.employee_number, filters.employee_number)
      )
    })
  }, [drivers, filters])

  const selectedIdSet = React.useMemo(() => new Set(selectedIds), [selectedIds])
  const visibleIds = React.useMemo(
    () => filteredDrivers.map((driver) => driver.provider_driver_id),
    [filteredDrivers]
  )
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((driverId) => selectedIdSet.has(driverId))
  const someVisibleSelected =
    visibleIds.length > 0 && visibleIds.some((driverId) => selectedIdSet.has(driverId))

  const updateFilter =
    (key: Exclude<keyof DriverFilters, "status">) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, [key]: event.target.value }))
    }

  const toggleDriver = (driverId: string, checked: boolean) => {
    const next = new Set(selectedIdSet)
    if (checked) {
      next.add(driverId)
    } else {
      next.delete(driverId)
    }
    onSelectionChange(Array.from(next))
  }

  const toggleAllVisible = (checked: boolean) => {
    const next = new Set(selectedIdSet)
    visibleIds.forEach((driverId) => {
      if (checked) {
        next.add(driverId)
      } else {
        next.delete(driverId)
      }
    })
    onSelectionChange(Array.from(next))
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Input value={filters.search} onChange={updateFilter("search")} placeholder="Search drivers" />
        <div className="text-sm text-muted-foreground md:text-right xl:col-span-2">
          Showing {filteredDrivers.length} of {drivers.length} drivers
        </div>
        <Input value={filters.name} onChange={updateFilter("name")} placeholder="Filter by name" />
        <Input
          value={filters.provider_driver_id}
          onChange={updateFilter("provider_driver_id")}
          placeholder="Filter by integration ID"
        />
        <Input value={filters.email} onChange={updateFilter("email")} placeholder="Filter by email" />
        <Input
          value={filters.telephone}
          onChange={updateFilter("telephone")}
          placeholder="Filter by telephone"
        />
        <Input
          value={filters.employee_number}
          onChange={updateFilter("employee_number")}
          placeholder="Filter by employee number"
        />
        <Select
          value={filters.status}
          onValueChange={(value: DriverFilters["status"]) =>
            setFilters((prev) => ({ ...prev, status: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="unknown">Unknown status</SelectItem>
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
                    aria-label="Select all drivers"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telephone</TableHead>
                <TableHead>Employee Number</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    No drivers match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDrivers.map((driver) => (
                  <TableRow key={driver.provider_driver_id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIdSet.has(driver.provider_driver_id)}
                        onChange={(event) =>
                          toggleDriver(driver.provider_driver_id, event.target.checked)
                        }
                        aria-label={`Select ${driver.name ?? driver.email ?? driver.provider_driver_id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div>{driver.name || "-"}</div>
                      <div className="text-xs text-muted-foreground">{driver.provider_driver_id}</div>
                    </TableCell>
                    <TableCell>{driver.email || "-"}</TableCell>
                    <TableCell>{driver.telephone || "-"}</TableCell>
                    <TableCell>{driver.employee_number || "-"}</TableCell>
                    <TableCell>
                      {driver.is_active === true
                        ? "Active"
                        : driver.is_active === false
                          ? "Inactive"
                          : "Unknown"}
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
