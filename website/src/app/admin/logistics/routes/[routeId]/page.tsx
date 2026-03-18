import { AdminLinks } from "@/lib/routes/admin"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { ErrorMessage } from "@/components/common/error-message"
import { Card, CardContent } from "@/components/ui/card"
import { RouteDialog } from "@/components/routes/route-dialog"
import { DeleteRouteDialog } from "@/components/routes/delete-route-dialog"
import { RouteMapCard } from "@/components/routes/route-map-card"
import { RouteStatsPanel } from "@/components/routes/route-stats-panel"
import { isApiErrorResponse } from "@/lib/api/client"
import { getRoute, getRouteStats } from "@/lib/api/routes"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import moment from "moment"

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ routeId: string }>
}) {
  const { routeId } = await params
  const session = await requireAuth()
  const scopedMerchantId = getScopedMerchantId(session)

  const route = await getRoute(routeId, session.accessToken, {
    merchant_id: scopedMerchantId,
  })

  if (isApiErrorResponse(route)) {
    return (
      <ErrorMessage
        title="Route"
        description="Route details and stop sequence."
        message={route.message}
      />
    )
  }

  const sortedStops = (route.stops ?? [])
    .slice()
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))

  const routeStats = await getRouteStats(routeId, session.accessToken, {
    merchant_id: scopedMerchantId,
  })
  const routeStatsError = isApiErrorResponse(routeStats) ? routeStats.message : null

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Routes", href: AdminLinks.routes },
          { label: route.title || "Route" },
        ]}
      />
      <PageHeader
        title={route.title || "Route"}
        description="Route details and stop sequence."
        actions={
          <div className="flex items-center gap-2">
            <RouteDialog
              route={route}
              merchantId={route.merchant_id}
              lockMerchant={session.user.role !== "super_admin"}
              accessToken={session.accessToken}
            />
            <DeleteRouteDialog route={route} accessToken={session.accessToken} />
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 text-sm">


            <div>
              <div className="text-xs text-muted-foreground">Code</div>
              <div className="font-medium">{route.code ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Description</div>
              <div className="font-medium">{route.description ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Estimated distance</div>
              <div className="font-medium">
                {typeof route.estimated_distance === "number"
                  ? `${route.estimated_distance} km`
                  : "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Estimated duration</div>
              <div className="font-medium">
                {typeof route.estimated_duration === "number"
                  ? `${route.estimated_duration} min`
                  : "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                Estimated collection time
              </div>
              <div className="font-medium">
                {typeof route.estimated_collection_time === "number"
                  ? `${route.estimated_collection_time} min`
                  : "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                Estimated delivery time
              </div>
              <div className="font-medium">
                {typeof route.estimated_delivery_time === "number"
                  ? `${route.estimated_delivery_time} min`
                  : "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Auto created</div>
              <div className="font-medium">{route.auto_created ? "Yes" : "No"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Created</div>
              <div className="font-medium">
                {route.created_at ? moment(route.created_at).format("YYYY-MM-DD HH:mm") : "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Updated</div>
              <div className="font-medium">
                {route.updated_at ? moment(route.updated_at).format("YYYY-MM-DD HH:mm") : "-"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium">Stops</div>
            <div className="text-xs text-muted-foreground">
              Use Edit route to add, remove, or resequence locations.
            </div>
          </div>
          {sortedStops.length === 0 ? (
            <div className="text-sm text-muted-foreground">No stops on this route.</div>
          ) : (
            <div className="space-y-2">
              {sortedStops.map((stop) => (
                <div
                  key={stop.stop_id ?? `${stop.location_id}-${stop.sequence}`}
                  className="rounded-md border border-border/60 p-3"
                >
                  <div className="text-sm font-medium">Stop {stop.sequence}</div>
                  <div className="text-xs text-muted-foreground">
                    {stop.location?.name ??
                      stop.location?.company ??
                      stop.location?.code ??
                      stop.location_id ??
                      "-"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stop.location?.full_address ?? "-"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RouteMapCard
        stops={sortedStops.map((stop, index) => ({
          stopId: stop.stop_id ?? `${stop.location_id ?? "stop"}-${stop.sequence ?? index}`,
          sequence: stop.sequence ?? index + 1,
          name:
            stop.location?.name ??
            stop.location?.company ??
            stop.location?.code ??
            stop.location_id ??
            "Stop",
          address: stop.location?.full_address ?? "-",
          latitude: stop.location?.latitude,
          longitude: stop.location?.longitude,
          location: stop.location ?? null,
        }))}
      />

      <RouteStatsPanel
        stats={isApiErrorResponse(routeStats) ? null : routeStats}
        errorMessage={routeStatsError}
      />
    </div>
  )
}
