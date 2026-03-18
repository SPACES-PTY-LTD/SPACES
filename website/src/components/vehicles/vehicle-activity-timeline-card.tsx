"use client"

import { AdminLinks, AdminRoute, withAdminQuery } from "@/lib/routes/admin"
import * as React from "react"
import Link from "next/link"
import moment from "moment"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { isApiErrorResponse } from "@/lib/api/client"
import { listVehicleActivities } from "@/lib/api/vehicle-activities"
import type { VehicleActivity } from "@/lib/types"
import { Loader2 } from "lucide-react"

type VehicleActivityTimelineCardProps = {
  vehicleId: string
  merchantId?: string
  accessToken?: string
  perPage?: number
}

function formatEventType(value?: string | null) {
  return value
    ? value
        .split("_")
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ")
    : "-"
}

function getEventLocationLabel(activity: VehicleActivity) {
  const isLocationEvent =
    activity.event_type === "entered_location" ||
    activity.event_type === "exited_location"
  if (!isLocationEvent) {
    return activity.location?.name ?? activity.location_id ?? "No location"
  }
  return (
    activity.location?.name ??
    activity.location?.company ??
    activity.location_id ??
    "No location"
  )
}

function getPositiveInt(value: unknown, fallback: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}

export function VehicleActivityTimelineCard({
  vehicleId,
  merchantId,
  accessToken,
  perPage = 10,
}: VehicleActivityTimelineCardProps) {
  const [items, setItems] = React.useState<VehicleActivity[]>([])
  const [currentPage, setCurrentPage] = React.useState(1)
  const [lastPage, setLastPage] = React.useState(1)
  const [loadingInitial, setLoadingInitial] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const loadPage = React.useCallback(
    async (page: number, append: boolean) => {
      const response = await listVehicleActivities(accessToken, {
        page,
        per_page: perPage,
        vehicle_id: vehicleId,
        merchant_id: merchantId,
      })

      if (isApiErrorResponse(response)) {
        setError(response.message)
        return
      }

      const nextItems = response.data ?? []
      const nextCurrentPage = getPositiveInt(response.meta?.current_page, page)
      const nextLastPage = getPositiveInt(
        response.meta?.last_page,
        getPositiveInt(response.meta?.total, nextItems.length) > 0 ? nextCurrentPage : 1
      )

      setError(null)
      setItems((prev) => (append ? [...prev, ...nextItems] : nextItems))
      setCurrentPage(nextCurrentPage)
      setLastPage(nextLastPage)
    },
    [accessToken, merchantId, perPage, vehicleId]
  )

  React.useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoadingInitial(true)
      await loadPage(1, false)
      if (!cancelled) {
        setLoadingInitial(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [loadPage])

  const handleLoadMore = async () => {
    if (loadingMore || currentPage >= lastPage) return
    setLoadingMore(true)
    await loadPage(currentPage + 1, true)
    setLoadingMore(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Latest vehicle activities</CardTitle>
          <Link
            href={withAdminQuery(AdminLinks.vehicleActivities, { vehicle_id: vehicleId })}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loadingInitial ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading activities...
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No recent vehicle activity found.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative pl-6 before:absolute before:left-2 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
              {items.map((activity, index) => {
                const locationEntryId = activity.location?.location_id

                return (
                  <div
                    key={activity.activity_id}
                    className={`relative pb-5 ${index === items.length - 1 ? "pb-0" : ""}`}
                  >
                    <span className="absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border border-primary/40 bg-primary/20" />
                    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-medium">
                          {formatEventType(activity.event_type)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {activity.occurred_at
                            ? moment(activity.occurred_at).format("YYYY-MM-DD HH:mm")
                            : "-"}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {locationEntryId ? (
                          <Link
                            href={AdminRoute.locationDetails(locationEntryId)}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {getEventLocationLabel(activity)}
                          </Link>
                        ) : (
                          getEventLocationLabel(activity)
                        )}
                        {" · "}
                        {typeof activity.speed_kph === "number"
                          ? `${activity.speed_kph} kph`
                          : "No speed"}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {currentPage < lastPage ? (
              <div className="flex justify-center">
                <Button type="button" variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
