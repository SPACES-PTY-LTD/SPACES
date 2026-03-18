"use client"

import * as React from "react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isApiErrorResponse } from "@/lib/api/client"
import { getFleetStatus, type FleetStatusReport } from "@/lib/api/reports"

const COLORS = {
  active: "var(--color-chart-2)",
  maintenance: "var(--color-chart-5)",
  standby: "var(--color-chart-3)",
} as const

const LABELS = {
  active: "Active",
  maintenance: "Maintenance",
  standby: "Standby",
} as const

type StatusKey = keyof typeof LABELS

const EMPTY_REPORT: FleetStatusReport = {
  active: 0,
  maintenance: 0,
  standby: 0,
  total: 0,
}

export function FleetStatusChart({
  accessToken,
  merchantId,
}: {
  accessToken?: string
  merchantId?: string | null
}) {
  const [loading, setLoading] = React.useState(false)
  const [report, setReport] = React.useState<FleetStatusReport>(EMPTY_REPORT)

  React.useEffect(() => {
    if (!merchantId) {
      setReport(EMPTY_REPORT)
      return
    }

    let active = true

    const loadData = async () => {
      setLoading(true)
      const response = await getFleetStatus(accessToken, { merchant_id: merchantId })
      if (!active) return

      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Failed to load fleet status.")
        setLoading(false)
        return
      }

      setReport(response.data ?? EMPTY_REPORT)
      setLoading(false)
    }

    void loadData()

    return () => {
      active = false
    }
  }, [accessToken, merchantId])

  const data = (Object.keys(LABELS) as StatusKey[]).map((key) => ({
    key,
    name: LABELS[key],
    value: report[key],
    fill: COLORS[key],
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fleet status</CardTitle>
        <div className="text-xs text-muted-foreground">
          Active, maintenance, and standby vehicles for the selected merchant.
        </div>
      </CardHeader>
      <CardContent>
        {!merchantId ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            Select a merchant to view fleet status.
          </div>
        ) : loading ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            Loading chart...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr] md:items-center">
            <div className="h-[300px] ">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={0}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Vehicles"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-4">
                <div className="text-xs text-muted-foreground">Total fleet</div>
                <div className="text-2xl font-semibold">{report.total}</div>
              </div>
              {data.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span className="text-sm">{entry.name}</span>
                  </div>
                  <span className="text-sm font-medium">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
