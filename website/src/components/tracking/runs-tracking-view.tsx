"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatusBadge } from "@/components/common/status-badge"
import { ShipmentStopsOverview } from "@/components/shipments/shipment-stops-overview"
import { isApiErrorResponse } from "@/lib/api/client"
import { listRuns } from "@/lib/api/runs"
import { cn } from "@/lib/utils"
import type { ApiListResponse, Run, ShipmentStop } from "@/lib/types"
import { Filter, Loader2, MessageCircle, Phone, Truck } from "lucide-react"
import { formatAddress } from "@/lib/address"

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function getProgress(run: Run) {
  const total = Number(run.shipment_count ?? run.shipments?.length ?? 0)
  if (total <= 0) return 0
  const completed = (run.shipments ?? []).filter(
    (shipment) => shipment.run_status === "done" || shipment.shipment_status === "delivered"
  ).length
  return Math.round((completed / total) * 100)
}

function getTotalParcels(run: Run) {
  return (run.shipments ?? []).reduce((sum, shipment) => {
    return sum + Math.max(0, Number(shipment.total_parcel_count ?? 0))
  }, 0)
}

function formatRunStopLocation(
  location?:
    | {
        code?: string | null
        city?: string | null
        province?: string | null
        country?: string | null
        full_address?: string | null
      }
    | null
) {
  if (!location) return ""
  return (
    location.full_address ??
    [location.code, location.city, location.province, location.country]
      .filter(Boolean)
      .join(", ")
  )
}

type PaginationMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

function normalizeMeta(meta?: ApiListResponse<Run>["meta"]): PaginationMeta | null {
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

function mergeRuns(existing: Run[], incoming: Run[]) {
  const byId = new Map<string, Run>()
  existing.forEach((run) => byId.set(run.run_id, run))
  incoming.forEach((run) => byId.set(run.run_id, run))
  return Array.from(byId.values())
}

export function RunsTrackingView({
  runs,
  accessToken,
  merchantId,
  initialMeta,
}: {
  runs: Run[]
  accessToken: string
  merchantId?: string
  initialMeta?: ApiListResponse<Run>["meta"]
}) {
  const [query, setQuery] = React.useState("")
  const [allRuns, setAllRuns] = React.useState<Run[]>(runs)
  const [selectedId, setSelectedId] = React.useState(runs[0]?.run_id ?? "")
  const [meta, setMeta] = React.useState<PaginationMeta | null>(() =>
    normalizeMeta(initialMeta)
  )
  const deferredQuery = React.useDeferredValue(query)
  const initialPerPage = React.useMemo(
    () => normalizeMeta(initialMeta)?.per_page ?? 15,
    [initialMeta]
  )
  const activeSearch = deferredQuery.trim()
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [loadingSearch, setLoadingSearch] = React.useState(false)
  const [loadingError, setLoadingError] = React.useState<string | null>(null)
  const listContainerRef = React.useRef<HTMLDivElement | null>(null)
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null)
  const selected = allRuns.find((run) => run.run_id === selectedId) ?? allRuns[0]
  const hasMore = Boolean(meta && meta.current_page < meta.last_page)
  const totalParcels = React.useMemo(() => (selected ? getTotalParcels(selected) : 0), [selected])
  const selectedRunStops = React.useMemo<ShipmentStop[]>(() => {
    if (!selected) return []

    const activityStops = selected.stops ?? []
    const hasMappedActivityStops = activityStops.some(
      (stop) =>
        typeof stop.latitude === "number" ||
        typeof stop.longitude === "number" ||
        typeof stop.location?.latitude === "number" ||
        typeof stop.location?.longitude === "number"
    )

    if (hasMappedActivityStops) {
      return activityStops.map((stop, index) => ({
        ...stop,
        activity_id: stop.activity_id ?? `${selected.run_id}-activity-stop-${index + 1}`,
        run_id: stop.run_id ?? selected.run_id,
        event_type: stop.event_type ?? "run_stop",
      }))
    }

    const routeStops = selected.route?.stops ?? []
    if (routeStops.length > 0) {
      return routeStops.map((stop, index) => {
        const relatedShipment = selected.shipments?.find((shipment) => {
          const pickupOrder = shipment.pickup_stop_order
          const dropoffOrder = shipment.dropoff_stop_order
          return pickupOrder === stop.sequence || dropoffOrder === stop.sequence
        })

        return {
          activity_id: stop.stop_id ?? `${selected.run_id}-route-stop-${index + 1}`,
          run_id: selected.run_id,
          event_type: "run_stop",
          occurred_at: undefined,
          vehicle: selected.vehicle
            ? {
                vehicle_id: selected.vehicle.vehicle_id,
                plate_number: selected.vehicle.plate_number ?? null,
              }
            : null,
          driver: selected.driver
            ? {
                driver_id: selected.driver.driver_id,
                name: selected.driver.name,
              }
            : null,
          location: stop.location
            ? {
                location_id: stop.location.location_id ?? stop.location_id ?? null,
                name: stop.location.name ?? null,
                company: stop.location.company ?? null,
                code: stop.location.code ?? null,
                full_address: stop.location.full_address ?? null,
                latitude: stop.location.latitude ?? null,
                longitude: stop.location.longitude ?? null,
                city: stop.location.city ?? null,
                province: stop.location.province ?? null,
                country: stop.location.country ?? null,
              }
            : null,
          latitude: stop.location?.latitude ?? null,
          longitude: stop.location?.longitude ?? null,
          shipment: {
            shipment_id: relatedShipment?.shipment_id,
            merchant_order_ref: relatedShipment?.merchant_order_ref ?? null,
            status: relatedShipment?.shipment_status ?? null,
          },
          metadata: {
            stop_sequence: stop.sequence,
            source: "route_plan",
          },
        }
      })
    }

    return []
  }, [selected])

  React.useEffect(() => {
    if (selected && selected.run_id !== selectedId) {
      setSelectedId(selected.run_id)
    }
  }, [selected, selectedId])

  React.useEffect(() => {
    let cancelled = false

    const loadRuns = async () => {
      setLoadingSearch(true)
      setLoadingError(null)

      const response = await listRuns(accessToken, {
        merchant_id: merchantId,
        page: 1,
        per_page: meta?.per_page ?? initialPerPage,
        search: activeSearch || undefined,
      })

      if (cancelled) {
        return
      }

      if (isApiErrorResponse(response)) {
        setLoadingError(response.message)
        setAllRuns([])
        setMeta(null)
        setSelectedId("")
        setLoadingSearch(false)
        return
      }

      const nextRuns = response.data ?? []
      setAllRuns(nextRuns)
      setMeta(normalizeMeta(response.meta))
      setSelectedId(nextRuns[0]?.run_id ?? "")
      setLoadingSearch(false)
    }

    void loadRuns()

    return () => {
      cancelled = true
    }
  }, [accessToken, activeSearch, initialPerPage, merchantId])

  const handleLoadMore = React.useCallback(async () => {
    if (!meta || loadingMore || !hasMore || loadingSearch) return

    setLoadingMore(true)
    setLoadingError(null)
    const response = await listRuns(accessToken, {
      merchant_id: merchantId,
      page: meta.current_page + 1,
      per_page: meta.per_page,
      search: activeSearch || undefined,
    })

    if (isApiErrorResponse(response)) {
      setLoadingError(response.message)
      setLoadingMore(false)
      return
    }

    setAllRuns((previous) => mergeRuns(previous, response.data ?? []))
    setMeta((previousMeta) => normalizeMeta(response.meta) ?? previousMeta)
    setLoadingMore(false)
  }, [accessToken, activeSearch, hasMore, loadingMore, loadingSearch, merchantId, meta])

  React.useEffect(() => {
    if (!hasMore || loadingMore || loadingError) return
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
  }, [handleLoadMore, hasMore, loadingError, loadingMore])

  if (allRuns.length === 0 && !loadingSearch) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          {activeSearch ? "No runs match your search." : "There is currently no runs to display"}
        </CardContent>
      </Card>
    )
  }

  console.log("Selected run:", selected)

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:h-[calc(100vh-12rem)]">
      <div className="overflow-hidden lg:h-full">
        
          <div className="flex items-center gap-2 mb-4">
            <Input
              placeholder="Search runs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button variant="outline" size="icon" className="shrink-0" disabled>
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          <div
            ref={listContainerRef}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto h-[calc(100vh-12rem)] pr-1"
            id="runs-list"
          >
            {allRuns.map((run) => {
              const isActive = run.run_id === selected?.run_id
              const progress = getProgress(run)
              const runStops = run.stops ?? []
              const lastStop = runStops[runStops.length - 1]
              return (
                <button
                  key={run.run_id}
                  onClick={() => setSelectedId(run.run_id)}
                  className={cn(
                    "group w-full rounded-xl border border-border p-3 text-left transition",
                    "hover:border-border hover:bg-accent/40",
                    isActive && " bg-accent/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">
                        {run.vehicle?.plate_number ?? "No vehicle"}
                      </div>
                      {lastStop?.location && (
                        <div className="text-sm font-semibold">
                          {lastStop.location.name ??
                            lastStop.location.company ??
                            formatRunStopLocation(lastStop.location)}
                        </div>
                      )}
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background shadow-sm">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 border border-background shadow-sm">
                        <AvatarFallback>{run.driver?.name?.slice(0, 1) ?? "-"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-foreground">{run.driver?.name ?? "Unassigned driver"}</div>
                        <div>{run.status?.replace(/_/g, " ") ?? "-"}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-foreground">{run.shipment_count ?? 0} shipments</div>
                      <div>{formatDateTime(run.started_at ?? run.planned_start_at)}</div>
                    </div>
                  </div>

                  <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                  </div>
                </button>
              )
            })}
            {loadingSearch ? (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Loading runs...
              </div>
            ) : null}
            {loadingError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {loadingError}
              </div>
            ) : null}
            {hasMore ? (
              <div ref={loadMoreSentinelRef} className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore || loadingSearch}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading more runs
                    </>
                  ) : (
                    "Load more runs"
                  )}
                </Button>
              </div>
            ) : null}
          </div>
      </div>

      {selected ? (
        <div className="space-y-4 ">
          <Card className="">
            <CardContent className="space-y-4 p-3 h-[calc(100vh-7rem)] overflow-y-auto">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Run ID</div>
                  <div className="text-lg font-semibold">{selected.run_id}</div>
                   {selected.origin && (
                      <div className="mt-1 text-xs text-muted-foreground">{selected.origin ? `Origin: ${formatAddress(selected.origin)}` : null}</div>
                    )}
                    {selected.destination && (
                      <div className="mt-1 text-xs text-muted-foreground">{selected.destination ? `Destination: ${formatAddress(selected.destination)}` : null}</div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                  {selected.auto_created ? <StatusBadge status="auto" /> : null}
                  <StatusBadge status={selected.status ?? "active"} />
                  <Button size="icon" variant="outline" disabled>
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" disabled>
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Shipments</div>
                  <div className="text-sm font-semibold">{selected.shipment_count ?? 0}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Parcels</div>
                  <div className="text-sm font-semibold">{totalParcels}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Planned start</div>
                  <div className="text-sm font-semibold">{formatDateTime(selected.planned_start_at)}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <ShipmentStopsOverview stops={selectedRunStops} />
              </div>

              <div className="relative overflow-hidden rounded-xl border border-border p-4">
                <div className="relative z-10 mt-4 grid gap-2 text-xs">
                  {(selected.shipments ?? []).map((shipment) => (
                    <div
                      key={shipment.shipment_id}
                      className="flex items-center justify-between rounded-md border border-white/80 bg-white/85 px-3 py-2"
                    >
                      <div className="font-medium text-foreground">
                        {shipment.merchant_order_ref ?? shipment.shipment_id}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={shipment.shipment_status ?? "active"} />
                        <span className="text-muted-foreground">#{shipment.sequence ?? "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="bg-muted/30">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-background shadow-sm">
                      <AvatarFallback>{selected.driver?.name?.slice(0, 1) ?? "-"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-semibold">{selected.driver?.name ?? "Unassigned driver"}</div>
                      <div className="text-xs text-muted-foreground">
                        {selected.vehicle?.plate_number ?? "No vehicle"}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">Updated {formatDateTime(selected.updated_at)}</div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {loadingSearch ? "Loading runs..." : "No runs match your search."}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
