import { AdminLinks, withAdminQuery } from "@/lib/routes/admin"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreatedOverTimeChart } from "@/components/reports/created-over-time-chart"
import { FleetStatusChart } from "@/components/reports/fleet-status-chart"
import { requireAuth } from "@/lib/auth"
import { getDashboardStats } from "@/lib/api/reports"
import { isApiErrorResponse } from "@/lib/api/client"
import { listActivityLogs } from "@/lib/api/activity-logs"
import { listExpiredEntityFiles } from "@/lib/api/entity-files"
import { LiveBookingsMapSection } from "@/components/dashboard/live-bookings-map-section"
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card"
import { ExpiredFilesCard } from "@/components/dashboard/expired-files-card"

export default async function AdminDashboardPage() {
  const session = await requireAuth()
  const formatter = new Intl.NumberFormat("en-US")
  const selectedMerchantId = session.selected_merchant?.merchant_id
  let stats = {
    total_shipments: 0,
    delivered_shipments: 0,
    in_transit_bookings: 0,
    pending_shipments: 0,
    active_merchants: 0,
    active_quotes: 0,
    total_members: 0,
    vehicles_count: 0,
  }

  const response = await getDashboardStats(session.accessToken, {
    merchant_id: selectedMerchantId,
  })
  const activityResponse = selectedMerchantId
    ? await listActivityLogs(session.accessToken, {
        per_page: 5,
        page: 1,
        merchant_id: selectedMerchantId,
      })
    : null
  const expiredFilesResponse = selectedMerchantId
    ? await listExpiredEntityFiles(session.accessToken, {
        per_page: 5,
        merchant_id: selectedMerchantId,
      })
    : null

  if (isApiErrorResponse(response)) {
    console.error("Failed to load dashboard stats", response.message)
  } else {
    stats = response.data ?? stats
  }

  const activity =
    !activityResponse || isApiErrorResponse(activityResponse)
      ? []
      : activityResponse.data ?? []
  const expiredFiles =
    !expiredFilesResponse || isApiErrorResponse(expiredFilesResponse)
      ? []
      : expiredFilesResponse.data ?? []

  const kpis = [
    {
      label: "Total shipments",
      value: formatter.format(stats.total_shipments),
      href: AdminLinks.shipments,
    },
    {
      label: "In-transit bookings",
      value: formatter.format(stats.in_transit_bookings),
      href: withAdminQuery(AdminLinks.bookings, { status: "in_transit" }),
    },
    {
      label: "Delivered shipments",
      value: formatter.format(stats.delivered_shipments),
      href: withAdminQuery(AdminLinks.shipments, { status: "delivered" }),
    },
    {
      label: "Pending shipments",
      value: formatter.format(stats.pending_shipments),
      href: withAdminQuery(AdminLinks.shipments, { status: "pending" }),
    },
    {
      label: "Total fleet",
      value: formatter.format(stats.vehicles_count),
      href: withAdminQuery(AdminLinks.vehicles, { status: "active" }),
    },
    // {
    //   label: "Active quotes",
    //   value: formatter.format(stats.active_quotes),
    //   href: withAdminQuery(AdminLinks.quotes, { status: "active" }),
    // },
    // {
    //   label: "Total members",
    //   value: formatter.format(stats.total_members),
    //   href: AdminLinks.members,
    // },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin dashboard"
        description="Live performance across merchants, carriers, and shipments."
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="group">
            <Card className="gap-0 py-3 transition-shadow group-hover:shadow-md">
              <CardHeader className="px-3">
                <CardTitle className="text-sm text-muted-foreground mb-0 pb-0">
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold pt-0 px-3">
                {kpi.value}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <CreatedOverTimeChart
          accessToken={session.accessToken}
          merchantId={selectedMerchantId}
        />
        <LiveBookingsMapSection
          accessToken={session.accessToken}
          merchantId={selectedMerchantId}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <RecentActivityCard activity={activity} />
        <ExpiredFilesCard files={expiredFiles} />
        <FleetStatusChart
          accessToken={session.accessToken}
          merchantId={selectedMerchantId}
        />
      </div>
    </div>
  )
}
