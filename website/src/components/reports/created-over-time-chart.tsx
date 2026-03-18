"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import moment from "moment"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isApiErrorResponse } from "@/lib/api/client"
import { getCreatedOverTime, type CreatedOverTimePoint } from "@/lib/api/reports"

const DATE_RANGES = [
  { label: "1 week", value: "1week" },
  { label: "2 weeks", value: "2weeks" },
  { label: "1 month", value: "1month" },
  { label: "3 months", value: "3months" },
  { label: "6 months", value: "6months" },
  { label: "1 year", value: "1year" },
  { label: "All time", value: "alltime" },
] as const

type ChartPoint = {
  date: string
  quoted: number
  shipped: number
  booked: number
}

export function CreatedOverTimeChart({
  accessToken,
  merchantId,
  initialRange = "1month",
}: {
  accessToken?: string
  merchantId?: string | null
  initialRange?: string
}) {
  const [range, setRange] = React.useState(initialRange)
  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<ChartPoint[]>([])

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await getCreatedOverTime(range, accessToken, {
        merchant_id: merchantId ?? undefined,
      })
      if (isApiErrorResponse(response)) {
        toast.error(response.message)
        return
      }
      const points: ChartPoint[] = (response.data ?? []).map(
        (point: CreatedOverTimePoint) => ({
          date: point.date,
          quoted: Number(point.quoted ?? 0),
          shipped: Number(point.shiped ?? 0),
          booked: Number(point.booked ?? 0),
        })
      )
      setData(points)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load report data."
      )
    } finally {
      setLoading(false)
    }
  }, [range, accessToken, merchantId])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Created over time</CardTitle>
          <div className="text-xs text-muted-foreground">
            Quotes, shipments, and bookings created in the selected range.
          </div>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="h-[320px]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading chart...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 16, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="quoted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="shipped" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="booked" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => moment(value).format("MMM D")}
                tick={{ fontSize: 12 }}
                stroke="var(--muted-foreground)"
              />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <Tooltip
                formatter={(value, name) => [value, String(name).toUpperCase()]}
                labelFormatter={(label) =>
                  moment(label).format("YYYY-MM-DD")
                }
                labelStyle={{ fontSize: 12, fontWeight: "bold" }}
              />
              <Area
                type="monotone"
                dataKey="quoted"
                stroke="#2563eb"
                fill="url(#quoted)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="shipped"
                stroke="#16a34a"
                fill="url(#shipped)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="booked"
                stroke="#f97316"
                fill="url(#booked)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
