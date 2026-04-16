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
import { listLocations, updateLocation } from "@/lib/api/locations"
import type { LocationType, Tag } from "@/lib/types"

type LocationsTableRow = {
  location_id?: string
  name?: string
  code?: string
  company?: string
  type?: string
  tags?: Tag[]
  city?: string
  href?: string
}

type TableMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type LocationsTableProps = {
  accessToken?: string
  merchantId?: string | null
  rows: LocationsTableRow[]
  meta?: TableMeta
  loadingError?: string | null
  locationTypes: LocationType[]
  filters: Filter<LocationsTableRow>[]
}

function parseQueryParam(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)
  return value && value.trim().length > 0 ? value : undefined
}

function getSettledErrorMessage<T>(
  results: PromiseSettledResult<T>[],
  fallback: string
) {
  for (const result of results) {
    if (result.status === "rejected") {
      return result.reason instanceof Error ? result.reason.message : fallback
    }

    if (isApiErrorResponse(result.value)) {
      return result.value.message || fallback
    }
  }

  return null
}

async function resolveSelectedLocationIds({
  selection,
  accessToken,
  merchantId,
}: {
  selection: DataTableSelectionState<LocationsTableRow>
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
    const response = await listLocations(accessToken, {
      merchant_id: merchantId ?? undefined,
      page,
      per_page: perPage,
      search: parseQueryParam(selection.queryParams, "search"),
      location_type_id: parseQueryParam(selection.queryParams, "location_type_id"),
      tag_id: parseQueryParam(selection.queryParams, "tag_id"),
      sort_by: parseQueryParam(selection.queryParams, "sort_by"),
      sort_dir: parseQueryParam(selection.queryParams, "sort_dir") as "asc" | "desc" | undefined,
    })

    if (isApiErrorResponse(response)) {
      throw new Error(response.message || "Failed to load the selected locations.")
    }

    for (const location of response.data ?? []) {
      if (location.location_id) {
        collectedIds.add(location.location_id)
      }
    }

    lastPage = Math.max(response.meta?.last_page ?? 1, 1)
    page += 1
  } while (page <= lastPage)

  return Array.from(collectedIds)
}

function BulkUpdateLocationTypeAction({
  selection,
  accessToken,
  merchantId,
  locationTypes,
}: {
  selection: DataTableSelectionState<LocationsTableRow>
  accessToken?: string
  merchantId?: string | null
  locationTypes: LocationType[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [locationTypeId, setLocationTypeId] = React.useState("")

  React.useEffect(() => {
    if (!open) {
      setLocationTypeId("")
    }
  }, [open])

  const availableLocationTypes = React.useMemo(
    () =>
      locationTypes.filter(
        (item): item is LocationType & { location_type_id: string } =>
          typeof item.location_type_id === "string" && item.location_type_id.length > 0
      ),
    [locationTypes]
  )

  const handleSubmit = React.useCallback(async () => {
    if (!locationTypeId) {
      toast.error("Select a location type.")
      return
    }

    setSubmitting(true)

    try {
      const locationIds = await resolveSelectedLocationIds({
        selection,
        accessToken,
        merchantId,
      })

      if (locationIds.length === 0) {
        toast.error("No locations selected.")
        setSubmitting(false)
        return
      }

      const results = await Promise.allSettled(
        locationIds.map((locationId) =>
          updateLocation(
            locationId,
            {
              merchant_id: merchantId ?? undefined,
              location_type_id: locationTypeId,
            },
            accessToken
          )
        )
      )

      const failureMessage = getSettledErrorMessage(
        results,
        "Failed to update some locations."
      )

      if (failureMessage) {
        const message = failureMessage
        toast.error(message)
        setSubmitting(false)
        return
      }

      toast.success(
        locationIds.length === 1
          ? "Location type updated."
          : `Updated location type for ${locationIds.length} locations.`
      )
      selection.clearSelection()
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update locations."
      )
    } finally {
      setSubmitting(false)
    }
  }, [accessToken, locationTypeId, merchantId, router, selection])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={availableLocationTypes.length === 0}
      >
        Update location type
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update location type</DialogTitle>
            <DialogDescription>
              Choose the location type to apply to{" "}
              {selection.selectedCount === 1
                ? "the selected location."
                : `${selection.selectedCount} selected locations.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Select value={locationTypeId} onValueChange={setLocationTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select location type" />
              </SelectTrigger>
              <SelectContent>
                {availableLocationTypes.map((type) => (
                  <SelectItem
                    key={type.location_type_id}
                    value={type.location_type_id}
                  >
                    {type.title || type.slug || type.location_type_id}
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

export function LocationsTable({
  accessToken,
  merchantId,
  rows,
  meta,
  loadingError,
  locationTypes,
  filters,
}: LocationsTableProps) {
  return (
    <DataTable
      data={rows}
      meta={meta}
      loading_error={loadingError}
      filters={filters}
      columns={[
        { key: "name", label: "Name", link: "href" },
        { key: "code", label: "Code", link: "href" },
        { key: "company", label: "Company", link: "href" },
        { key: "type", label: "Type", link: "href" },
        { key: "tags", label: "Tags", type: "tags" },
        { key: "city", label: "City", link: "href" },
      ]}
      rowActions={[
        { label: "View", hrefKey: "href" },
        { label: "Edit" },
        { label: "Delete", variant: "destructive" },
      ]}
      selection={{
        idKey: "location_id",
        label: "locations",
        renderBulkActions: (selection) => (
          <BulkUpdateLocationTypeAction
            selection={selection}
            accessToken={accessToken}
            merchantId={merchantId}
            locationTypes={locationTypes}
          />
        ),
      }}
      enableSorting
      sortableColumns={["name", "code", "company", "type", "city"]}
    />
  )
}
