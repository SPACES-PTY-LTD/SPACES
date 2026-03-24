"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
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
import { Switch } from "@/components/ui/switch"
import { VehiclesMap } from "@/components/vehicles/vehicles-map"
import { isApiErrorResponse } from "@/lib/api/client"
import { listVehicles } from "@/lib/api/vehicles"
import type { ApiListResponse, Vehicle } from "@/lib/types"
import { Filter, Loader2, Search, Truck } from "lucide-react"

type PaginationMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

function normalizeMeta(meta?: ApiListResponse<Vehicle>["meta"]): PaginationMeta | null {
  if (!meta) return null

  const currentPage = meta.current_page ?? meta.page
  const perPage = meta.per_page ?? meta.perPage
  const total = meta.total
  const lastPage =
    meta.last_page ??
    (typeof perPage === "number" && perPage > 0 && typeof total === "number"
      ? Math.max(1, Math.ceil(total / perPage))
      : undefined)

  if (
    typeof currentPage !== "number" ||
    typeof perPage !== "number" ||
    typeof total !== "number" ||
    typeof lastPage !== "number"
  ) {
    return null
  }

  return {
    current_page: currentPage,
    last_page: lastPage,
    per_page: perPage,
    total,
  }
}

function getVehicleKey(vehicle: Vehicle, fallbackIndex: number) {
  return (
    vehicle.vehicle_id ??
    vehicle.vehicle_uuid ??
    vehicle.driver_vehicle_id ??
    vehicle.plate_number ??
    `vehicle-${fallbackIndex}`
  )
}

function getVehicleLabel(vehicle: Vehicle) {
  const makeAndModel = [vehicle.make, vehicle.model].filter(Boolean).join(" ")
  const plate = vehicle.plate_number ? ` - ${vehicle.plate_number}` : ""
  const fallback = vehicle.ref_code ?? "Vehicle"
  return `${makeAndModel || fallback}${plate}`
}

function mergeVehicles(existing: Vehicle[], incoming: Vehicle[]) {
  const byKey = new Map<string, Vehicle>()
  existing.forEach((vehicle, index) => {
    byKey.set(getVehicleKey(vehicle, index), vehicle)
  })
  incoming.forEach((vehicle, index) => {
    byKey.set(getVehicleKey(vehicle, existing.length + index), vehicle)
  })
  return Array.from(byKey.values())
}

type VehiclesMapPageContentProps = {
  accessToken: string
  merchantId?: string
  initialVehicles: Vehicle[]
  initialMeta?: ApiListResponse<Vehicle>["meta"]
  initialError?: string | null
}

export function VehiclesMapPageContent({
  accessToken,
  merchantId,
  initialVehicles,
  initialMeta,
  initialError,
}: VehiclesMapPageContentProps) {
  const initialPerPage = React.useMemo(
    () => normalizeMeta(initialMeta)?.per_page ?? 20,
    [initialMeta]
  )
  const [vehicles, setVehicles] = React.useState<Vehicle[]>(initialVehicles)
  const [meta, setMeta] = React.useState<PaginationMeta | null>(() =>
    normalizeMeta(initialMeta)
  )
  const [searchTerm, setSearchTerm] = React.useState("")
  const [activeSearch, setActiveSearch] = React.useState<string | undefined>(
    undefined
  )
  const [withLocationOnly, setWithLocationOnly] = React.useState(true)
  const [draftWithLocationOnly, setDraftWithLocationOnly] = React.useState(true)
  const [filterDialogOpen, setFilterDialogOpen] = React.useState(false)
  const [loadingError, setLoadingError] = React.useState<string | null>(
    initialError ?? null
  )
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [searching, setSearching] = React.useState(false)
  const [selectedVehicleKey, setSelectedVehicleKey] = React.useState<string | null>(
    null
  )
  const listContainerRef = React.useRef<HTMLDivElement | null>(null)
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null)

  const hasMore = Boolean(meta && meta.current_page < meta.last_page)
  const selectedVehicle =
    selectedVehicleKey === null
      ? null
      : vehicles.find(
          (vehicle, index) => getVehicleKey(vehicle, index) === selectedVehicleKey
        ) ?? null

  const runVehicleQuery = React.useCallback(
    async ({
      search,
      withLocationOnly: withLocationOnlyFilter,
    }: {
      search?: string
      withLocationOnly: boolean
    }) => {
      setSearching(true)
      setLoadingError(null)
      const response = await listVehicles(accessToken, {
        page: 1,
        per_page: initialPerPage,
        search,
        with_location_only: withLocationOnlyFilter,
        merchant_id: merchantId,
      })

      if (isApiErrorResponse(response)) {
        setLoadingError(response.message)
        setSearching(false)
        return false
      }

      setActiveSearch(search)
      setWithLocationOnly(withLocationOnlyFilter)
      setVehicles(response.data)
      setMeta(normalizeMeta(response.meta))
      setSelectedVehicleKey(null)
      setSearching(false)
      return true
    },
    [accessToken, initialPerPage, merchantId]
  )

  const handleLoadMore = React.useCallback(async () => {
    if (!meta || loadingMore || !hasMore) return

    setLoadingMore(true)
    setLoadingError(null)
    const nextPage = meta.current_page + 1
    const response = await listVehicles(accessToken, {
      page: nextPage,
      per_page: meta.per_page,
      search: activeSearch,
      with_location_only: withLocationOnly,
      merchant_id: merchantId,
    })

    if (isApiErrorResponse(response)) {
      setLoadingError(response.message)
      setLoadingMore(false)
      return
    }

    setVehicles((previous) => mergeVehicles(previous, response.data))
    setMeta((previousMeta) => normalizeMeta(response.meta) ?? previousMeta)
    setLoadingMore(false)
  }, [accessToken, activeSearch, hasMore, loadingMore, merchantId, meta, withLocationOnly])

  const handleSearchSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (searching) return

      const nextSearch = searchTerm.trim()
      const normalizedSearch = nextSearch.length > 0 ? nextSearch : undefined

      await runVehicleQuery({
        search: normalizedSearch,
        withLocationOnly,
      })
    },
    [runVehicleQuery, searchTerm, searching, withLocationOnly]
  )

  const handleFilterSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (searching) return
      const didUpdate = await runVehicleQuery({
        search: activeSearch,
        withLocationOnly: draftWithLocationOnly,
      })
      if (didUpdate) {
        setFilterDialogOpen(false)
      }
    },
    [activeSearch, draftWithLocationOnly, runVehicleQuery, searching]
  )

  const handleSelectVehicle = React.useCallback((key: string) => {
    setSelectedVehicleKey(key)
    if (typeof window !== "undefined") {
      document
        .getElementById("selected-vehicle-info")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [])

  React.useEffect(() => {
    if (!selectedVehicleKey) return
    const stillExists = vehicles.some(
      (vehicle, index) => getVehicleKey(vehicle, index) === selectedVehicleKey
    )
    if (!stillExists) {
      setSelectedVehicleKey(null)
    }
  }, [vehicles, selectedVehicleKey])

  React.useEffect(() => {
    if (!hasMore || loadingMore || searching || loadingError) return
    if (!listContainerRef.current || !loadMoreSentinelRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0]
        if (firstEntry?.isIntersecting) {
          void handleLoadMore()
        }
      },
      {
        root: listContainerRef.current,
        rootMargin: "80px",
        threshold: 0.1,
      }
    )

    observer.observe(loadMoreSentinelRef.current)

    return () => {
      observer.disconnect()
    }
  }, [handleLoadMore, hasMore, loadingError, loadingMore, searching])

  return (
    <div className="rounded-md overflow-hidden border flex min-h-[calc(100vh-10rem)]">
      <div className="w-sm p-4">
        <form id="vehicle-search-form" className="flex items-center space-x-2" onSubmit={handleSearchSubmit}>

          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            disabled={searching}
          />
          <div className="flex items-center justify-center space-x-2">
            <Button
              type="submit"
              variant={"outline"}
              size={"icon"}
              disabled={searching}
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={"outline"}
              size={"icon"}
              id="filter-button"
              disabled={searching}
              onClick={() => {
                setDraftWithLocationOnly(withLocationOnly)
                setFilterDialogOpen(true)
              }}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </form>
        <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vehicle Filters</DialogTitle>
              <DialogDescription>
                Choose how vehicles are included in the list and map.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFilterSubmit} className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="with-location-only">
                  Only show vehicles with location
                </Label>
                <Switch
                  id="with-location-only"
                  checked={draftWithLocationOnly}
                  onCheckedChange={setDraftWithLocationOnly}
                  disabled={searching}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFilterDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={searching}>
                  Apply filters
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <div className="mt-4">
          {loadingError && vehicles.length === 0 ? (
            <div className="text-sm text-destructive">{loadingError}</div>
          ) : (
            <div
              ref={listContainerRef}
              className="text-sm overflow-y-auto max-h-[calc(100vh-16rem)] space-y-2"
            >
              {vehicles.map((vehicle, index) => (
                <button
                  type="button"
                  key={getVehicleKey(vehicle, index)}
                  className={`flex w-full p-2 justify-start items-center gap-2 border rounded-lg transition-colors ${
                    getVehicleKey(vehicle, index) === selectedVehicleKey
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-neutral-50"
                  }`}
                  onClick={() => handleSelectVehicle(getVehicleKey(vehicle, index))}
                >
                  <div className="w-12 h-12 bg-secondary flex items-center justify-center rounded-lg">
                    <Truck className="w-6 h-6 text-foreground m-auto" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-bold">
                      {getVehicleLabel(vehicle)}
                    </div>
                    <div className="text-muted-foreground">
                      {vehicle.last_location_address?.address_line_1 ??
                        ""}
                    </div>
                  </div>
                </button>
              ))}

              {vehicles.length === 0 ? (
                <div className="text-muted-foreground">No vehicles found.</div>
              ) : null}

              {hasMore ? <div ref={loadMoreSentinelRef} className="h-1" /> : null}

              {loadingMore ? (
                <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading more...
                </div>
              ) : null}

              {loadingError && vehicles.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm text-destructive">{loadingError}</div>
                  {hasMore ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={handleLoadMore}
                    >
                      Retry load more
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <VehiclesMap
        vehicles={vehicles}
        selectedVehicleKey={selectedVehicleKey}
        selectedVehicle={selectedVehicle}
        onSelectVehicle={handleSelectVehicle}
        onClearSelection={() => setSelectedVehicleKey(null)}
      />
    </div>
  )
}
