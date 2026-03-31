import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { ShipmentsByLocationChart } from "@/components/reports/shipments-by-location-chart"
import { ShipmentsByLocationControls } from "@/components/reports/shipments-by-location-controls"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getShipmentsByLocationReport, type ShipmentsByLocationReportParams } from "@/lib/api/reports"
import { isApiErrorResponse } from "@/lib/api/client"
import { requireAuth } from "@/lib/auth"

type PageProps = {
  searchParams?: Promise<{
    date_range?: string
    location_type?: string
  }>
}

const DATE_RANGES = [
  "1week",
  "2weeks",
  "30days",
  "1month",
  "3months",
  "6months",
  "1year",
  "alltime",
] as const satisfies readonly NonNullable<ShipmentsByLocationReportParams["date_range"]>[]

function normalizeDateRange(
  value?: string
): NonNullable<ShipmentsByLocationReportParams["date_range"]> {
  return value && DATE_RANGES.includes(value as (typeof DATE_RANGES)[number])
    ? (value as (typeof DATE_RANGES)[number])
    : "1month"
}

function normalizeLocationType(value?: string): "pickup" | "dropoff" {
  return value === "dropoff" ? "dropoff" : "pickup"
}

export default async function ShipmentsByLocationPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {}
  const dateRange = normalizeDateRange(params.date_range)
  const locationType = normalizeLocationType(params.location_type)

  const session = await requireAuth()
  const merchantId = session.selected_merchant?.merchant_id ?? undefined

  const response = await getShipmentsByLocationReport(
    {
      merchant_id: merchantId,
      date_range: dateRange,
      location_type: locationType,
    },
    session.accessToken
  )

  const rows = !isApiErrorResponse(response) ? response.data ?? [] : []
  const meta = !isApiErrorResponse(response) ? response.meta : undefined
  const tableRows = rows.map((row) => ({
    ...row,
    cityLabel: row.city ?? "-",
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipments by Location"
        description="Compare shipment volume by pickup and dropoff location over a selected date range."
        actions={<ShipmentsByLocationControls dateRange={dateRange} locationType={locationType} />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Location groups</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{meta?.total_locations ?? rows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total shipments</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{meta?.total_shipments ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Grouping</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold capitalize">{locationType}</CardContent>
        </Card>
      </div>

      <ShipmentsByLocationChart rows={rows} locationType={locationType} />

      <Card>
        <CardHeader>
          <CardTitle>Location totals</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={tableRows}
            emptyMessage="No shipment totals found for the selected range."
            columns={[
              { key: "location_name", label: "Location name" },
              { key: "cityLabel", label: "City" },
              { key: "total_shipments", label: "Total shipments", className: "text-right" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
