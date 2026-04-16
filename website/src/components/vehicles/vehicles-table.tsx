"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DataTable, type DataTableSelectionState, type Filter } from "@/components/common/data-table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isApiErrorResponse } from "@/lib/api/client"
import { listVehicles, updateVehicle } from "@/lib/api/vehicles"
import type { Tag, VehicleType } from "@/lib/types"

type VehiclesTableRow = {
  selection_id?: string
  vehicle_id?: string
  vehicle_uuid?: string
  plate_number?: string
  vin_number?: string | null
  intergration_id?: string | null
  type?: {
    name?: string
    vehicle_type_id?: string
  } | null
  make?: string
  model?: string
  last_known_location?: string
  location_updated_at?: string | null
  is_on_a_run_label?: string
  tags?: Tag[]
  status_label?: string
  href?: string
}

type TableMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type VehiclesTableProps = {
  accessToken?: string
  merchantId?: string | null
  rows: VehiclesTableRow[]
  meta?: TableMeta
  loadingError?: string | null
  vehicleTypes: VehicleType[]
  filters: Filter<VehiclesTableRow>[]
}

function parseQueryParam(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)
  return value && value.trim().length > 0 ? value : undefined
}

async function resolveSelectedVehicleIds({
  selection,
  accessToken,
  merchantId,
}: {
  selection: DataTableSelectionState<VehiclesTableRow>
  accessToken?: string
  merchantId?: string | null
}) {
  if (selection.mode !== "all_filtered") {
    return selection.selectedIds
  }

  const collectedIds = new Set<string>()
  const perPage = 100
  let page = 1
  let lastPage = 1

  do {
    const response = await listVehicles(accessToken, {
      merchant_id: merchantId ?? undefined,
      page,
      per_page: perPage,
      tag_id: parseQueryParam(selection.queryParams, "tag_id"),
      sort_by: parseQueryParam(selection.queryParams, "sort_by"),
      sort_dir: parseQueryParam(selection.queryParams, "sort_dir") as
        | "asc"
        | "desc"
        | undefined,
    })

    if (isApiErrorResponse(response)) {
      throw new Error(response.message || "Failed to load the selected vehicles.")
    }

    for (const vehicle of response.data ?? []) {
      const vehicleId = vehicle.vehicle_id ?? vehicle.vehicle_uuid
      if (vehicleId) {
        collectedIds.add(vehicleId)
      }
    }

    lastPage = Math.max(response.meta?.last_page ?? 1, 1)
    page += 1
  } while (page <= lastPage)

  return Array.from(collectedIds)
}

function BulkUpdateVehicleTypeAction({
  selection,
  accessToken,
  merchantId,
  vehicleTypes,
}: {
  selection: DataTableSelectionState<VehiclesTableRow>
  accessToken?: string
  merchantId?: string | null
  vehicleTypes: VehicleType[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [vehicleTypeId, setVehicleTypeId] = React.useState("")

  React.useEffect(() => {
    if (!open) {
      setVehicleTypeId("")
    }
  }, [open])

  const availableVehicleTypes = React.useMemo(
    () =>
      vehicleTypes.filter(
        (item): item is VehicleType & { vehicle_type_id: string } =>
          typeof item.vehicle_type_id === "string" && item.vehicle_type_id.length > 0
      ),
    [vehicleTypes]
  )

  const handleSubmit = React.useCallback(async () => {
    if (!vehicleTypeId) {
      toast.error("Select a vehicle type.")
      return
    }

    setSubmitting(true)

    try {
      const vehicleIds = await resolveSelectedVehicleIds({
        selection,
        accessToken,
        merchantId,
      })

      if (vehicleIds.length === 0) {
        toast.error("No vehicles selected.")
        setSubmitting(false)
        return
      }

      const results = await Promise.allSettled(
        vehicleIds.map((vehicleId) =>
          updateVehicle(
            vehicleId,
            {
              vehicle_type_id: vehicleTypeId,
              merchant_id: merchantId ?? undefined,
            },
            accessToken
          )
        )
      )

      const failed = results.filter((result) => {
        if (result.status === "rejected") return true
        return isApiErrorResponse(result.value)
      })

      if (failed.length > 0) {
        const firstFailure = failed[0]
        const message =
          firstFailure.status === "rejected"
            ? firstFailure.reason instanceof Error
              ? firstFailure.reason.message
              : "Failed to update some vehicles."
            : firstFailure.value.message || "Failed to update some vehicles."
        toast.error(message)
        setSubmitting(false)
        return
      }

      toast.success(
        vehicleIds.length === 1
          ? "Vehicle type updated."
          : `Updated vehicle type for ${vehicleIds.length} vehicles.`
      )
      selection.clearSelection()
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update vehicles."
      )
    } finally {
      setSubmitting(false)
    }
  }, [accessToken, merchantId, router, selection, vehicleTypeId])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={availableVehicleTypes.length === 0}
      >
        Update vehicle type
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update vehicle type</DialogTitle>
            <DialogDescription>
              Choose the vehicle type to apply to{" "}
              {selection.selectedCount === 1
                ? "the selected vehicle."
                : `${selection.selectedCount} selected vehicles.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Select value={vehicleTypeId} onValueChange={setVehicleTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle type" />
              </SelectTrigger>
              <SelectContent>
                {availableVehicleTypes.map((type) => (
                  <SelectItem
                    key={type.vehicle_type_id}
                    value={type.vehicle_type_id}
                  >
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function VehiclesTable({
  accessToken,
  merchantId,
  rows,
  meta,
  loadingError,
  vehicleTypes,
  filters,
}: VehiclesTableProps) {
  return (
    <DataTable
      data={rows}
      meta={meta}
      loading_error={loadingError}
      searchKeys={[
        "plate_number",
        "vin_number",
        "intergration_id",
        "make",
        "model",
        "type.name",
        "last_known_location",
        "tags",
      ]}
      filters={filters}
      columns={[
        { key: "plate_number", label: "Plate", link: "href" },
        { key: "vin_number", label: "VIN", link: "href" },
        { key: "intergration_id", label: "Integration ID", link: "href" },
        { key: "type.name", label: "Type", link: "href" },
        { key: "make", label: "Make", link: "href" },
        { key: "model", label: "Model", link: "href" },
        { key: "last_known_location", label: "Last known location", link: "href" },
        { key: "location_updated_at", label: "Last updated location at", type: "date_time", link: "href" },
        { key: "is_on_a_run_label", label: "Is on a run?", type: "status" },
        { key: "tags", label: "Tags", type: "tags" },
        { key: "status_label", label: "Status", type: "status", link: "href" },
      ]}
      rowActions={[
        { label: "View", hrefKey: "href" },
        { label: "Edit" },
        { label: "Delete", variant: "destructive" },
      ]}
      selection={{
        idKey: "selection_id",
        label: "vehicles",
        renderBulkActions: (selection) => (
          <BulkUpdateVehicleTypeAction
            selection={selection}
            accessToken={accessToken}
            merchantId={merchantId}
            vehicleTypes={vehicleTypes}
          />
        ),
      }}
      enableSorting
      sortableColumns={["plate_number", "type.name", "make", "model", "status_label"]}
      sortKeyMap={{ "type.name": "type", status_label: "is_active" }}
    />
  )
}
