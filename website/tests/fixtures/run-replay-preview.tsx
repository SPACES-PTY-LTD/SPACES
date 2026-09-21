"use client"
import * as React from "react"
import { RunActualMap } from "@/components/runs/run-actual-map"
import type { ShipmentStop } from "@/lib/types"
const at = (minutes: number) => new Date(Date.UTC(2026, 8, 21, 6, minutes)).toISOString()
const points = Array.from({ length: 131 }, (_, i) => ({ latitude: -26.04 - i * 0.00065, longitude: 28.025 + i * 0.0003, observed_at: at(i * 3) }))
const track = { status: "ready", source: "recorded_gps", active: false, segments: [points.slice(0, 81), points.slice(86)], stops: [], updated_at: at(390), latest_observed_at: at(390), coverage: { partial: true, displayed_coordinates: 126, next_before: null } }
const stops: ShipmentStop[] = [
 { activity_id: "collection", event_type: "shipment_collection", entered_at: at(0), exited_at: at(10), latitude: -26.04, longitude: 28.025, location: { name: "Collection depot" } },
 { activity_id: "stop1", event_type: "stopped", entered_at: at(58), exited_at: at(70), latitude: -26.053, longitude: 28.031 },
 { activity_id: "stop2", event_type: "stopped", entered_at: at(110), exited_at: at(120), latitude: -26.064, longitude: 28.036 },
 { activity_id: "delivery", event_type: "shipment_delivery", entered_at: at(150), exited_at: at(168), latitude: -26.073, longitude: 28.04, location: { name: "Sandton customer", type: { title: "Customer" } } },
 { activity_id: "stop3", event_type: "stopped", entered_at: at(225), exited_at: at(237), latitude: -26.089, longitude: 28.0475 },
 { activity_id: "end", event_type: "shipment_delivery", occurred_at: at(390), latitude: -26.1245, longitude: 28.064, location: { name: "Final customer" } },
]
const activities: ShipmentStop[] = [{ activity_id: "speeding", event_type: "speeding", occurred_at: at(195), latitude: -26.082, longitude: 28.0445, speed_kph: 100, speed_limit_kph: 80 }]
export default function Preview() {
 const [ready, setReady] = React.useState(false)
 React.useEffect(() => {
  const original = window.fetch
  window.fetch = (input, init) => {
    if (String(input).includes("/runs/replay-preview/track")) return Promise.resolve(new Response(JSON.stringify({ data: track }), { headers: { "Content-Type": "application/json" } }))
    return original(input, init)
  }
  setReady(true)
  return () => { window.fetch = original }
 }, [])
 return <main className="mx-auto max-w-[1440px] p-4"><p className="mb-3 text-xs text-muted-foreground">TEST FIXTURE · Illustrative trip · 21 Sep 2026 · No real run data</p>{ready && <RunActualMap runId="replay-preview" stops={stops} activities={activities} />}</main>
}
