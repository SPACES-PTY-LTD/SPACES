"use client"

import { useRouter } from "next/navigation"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ShipmentsByLocationRow } from "@/lib/api/reports"

function truncateLabel(value: string, max = 24) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function ShipmentsByLocationChart({
  rows,
  locationType,
}: {
  rows: ShipmentsByLocationRow[]
  locationType: "pickup" | "dropoff"
}) {
  const router = useRouter()
  const chartData = rows.slice(0, 10).map((row) => ({
    location_name: truncateLabel(row.location_name),
    total_shipments: row.total_shipments,
    city: row.city ?? "-",
    href: row.href,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipment totals by {locationType === "pickup" ? "pickup" : "dropoff"} location</CardTitle>
        <div className="text-xs text-muted-foreground">
          Top 10 locations in the selected date range.
        </div>
      </CardHeader>
      <CardContent className="h-[360px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 16, right: 20, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="location_name"
                angle={-30}
                textAnchor="end"
                interval={0}
                height={72}
                tick={{ fontSize: 12 }}
                stroke="var(--muted-foreground)"
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                formatter={(value) => [value, "Total shipments"]}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload
                  return item?.city ? `${label} • ${item.city}` : String(label)
                }}
              />
              <Bar
                dataKey="total_shipments"
                fill="var(--color-chart-1)"
                radius={[6, 6, 0, 0]}
                cursor="pointer"
                onClick={(data) => {
                  if (data?.href) {
                    router.push(data.href)
                  }
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No shipment data available for the selected range.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
