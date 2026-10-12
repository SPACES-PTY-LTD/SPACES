"use client"

// Local fixture; only mounted by the development-only preview route.
import { useEffect, useState } from "react"
import { ScheduleBoard } from "@/components/schedule/schedule-board"
import type { ScheduleData, ScheduleRun, ScheduleShipment } from "@/lib/api/schedule"

const location = (id: string, name: string) => ({ location_id: id, name })
const depot = location("11111111-1111-4111-8111-111111111111", "Engen Isando")
const mine = location("22222222-2222-4222-8222-222222222222", "Tharisa Mine")
const shipment = (id: string, runId: string | null = null): ScheduleShipment => ({ shipment_id: id, reference: `DN-${id}`, status: "draft", source_run_id: runId, collection_date: "2026-10-12T06:00:00Z", pickup: depot, dropoff: mine })
const run = (id: string, status: string, hour: string): ScheduleRun => ({ run_id: id, status, schedule_managed: true, planned_start_at: `2026-10-12T${hour}:00:00Z`, started_at: status === "in_progress" ? "2026-10-11T06:00:00Z" : null, overdue: false,
  can_assign_driver: status !== "in_progress", can_add_shipment: true, waiting_reason: status === "draft" ? "Waiting for an earlier run or an occupied driver/truck." : null,
  origin: depot, destination: mine, driver: status === "in_progress" ? { driver_id: "driver-1", name: "Alex Mokoena" } : null, shipments: [shipment(id, id)] })
const page = { current_page: 1, last_page: 1, total: 3 }
const initial: ScheduleData = { environments: [{ environment_id: "sandbox", name: "Sandbox" }], timezone: "Africa/Johannesburg", can_manage: true,
  drivers: [{ driver_id: "driver-1", name: "Alex Mokoena", phone: "071 000 0001", assigned: true }, { driver_id: "driver-2", name: "Zolani Ntantiso", phone: "071 000 0002", assigned: false }, { driver_id: "driver-3", name: "Yandisa Tenenengu", assigned: false }],
  trucks: [{ vehicle_id: "truck-1", plate_number: "694HJSGP", is_active: true, available: false, can_create: true, runs: [run("run-1", "in_progress", "06"), run("run-2", "draft", "12")] },
    { vehicle_id: "truck-2", plate_number: "700HJSGP", is_active: true, available: true, can_create: true, runs: [] },
    { vehicle_id: "truck-3", plate_number: "701HJSGP", is_active: true, available: false, can_create: true, runs: [{ ...run("run-3", "draft", "08"), overdue: true }] }],
  shipments: [shipment("1042"), shipment("1043"), shipment("1044")], pagination: { trucks: page, drivers: page, shipments: page } }

export default function SchedulePreview() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const original = window.fetch
    const data = structuredClone(initial)
    let counter = 10
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin)
      if (!url.pathname.startsWith("/api/v1/")) return original(input, init)
      const envelope = (value: unknown, meta = {}) => new Response(JSON.stringify({ success: true, data: value, meta }), { headers: { "Content-Type": "application/json" } })
      if (url.pathname === "/api/v1/schedule") {
        if (url.searchParams.get("truck_search") === "error") return new Response(JSON.stringify({ error: { message: "Fixture connection failed" } }), { status: 503 })
        const visible = structuredClone(data)
        const runs = data.trucks.flatMap(truck => truck.runs)
        visible.drivers.forEach(driver => { driver.assigned_runs = runs.filter(run => run.driver?.driver_id === driver.driver_id).map(run => ({ run_id: run.run_id, status: run.status, planned_start_at: run.planned_start_at })); driver.assigned = driver.assigned_runs.length > 0 })
        const contains = (text: string, search: string | null) => !search || text.toLowerCase().includes(search.toLowerCase())
        visible.drivers = visible.drivers.filter(driver => contains(driver.name, url.searchParams.get("driver_search")) && (url.searchParams.get("driver_filter") === "assigned" ? driver.assigned : url.searchParams.get("driver_filter") === "unassigned" ? !driver.assigned : true))
        visible.trucks = visible.trucks.filter(truck => contains(truck.plate_number, url.searchParams.get("truck_search")) && (url.searchParams.get("availability") === "available" ? truck.available : url.searchParams.get("availability") === "busy" ? !truck.available : true) && (url.searchParams.get("fleet_status") === "inactive" ? !truck.is_active : true))
        const statuses = url.searchParams.get("shipment_statuses")
        visible.shipments = visible.shipments.filter(shipment => contains(shipment.reference, url.searchParams.get("shipment_search")) && statuses !== "none" && (statuses === "all" || (statuses ? statuses.split(",").includes(shipment.status) : !["delivered", "failed", "cancelled", "returned"].includes(shipment.status))))
        if (url.searchParams.get("environment_id") === "sandbox" || url.searchParams.get("truck_search") === "empty") { visible.trucks = []; visible.drivers = []; visible.shipments = [] }
        visible.summary = { unassigned_drivers: visible.drivers.filter(driver => !driver.assigned).length, available_trucks: visible.trucks.filter(truck => truck.available).length, active_runs: visible.trucks.flatMap(truck => truck.runs).filter(run => run.status === "in_progress").length, overdue_plans: visible.trucks.flatMap(truck => truck.runs).filter(run => run.overdue).length, unassigned_shipments: visible.shipments.length }
        for (const key of ["drivers", "trucks", "shipments"] as const) visible.pagination[key].total = visible[key].length
        return envelope(visible)
      }
      if (url.pathname === "/api/v1/locations") return envelope([depot, mine], { current_page: 1, last_page: 1 })
      const body = JSON.parse(String(init?.body || "{}"))
      const allRuns = data.trucks.flatMap(truck => truck.runs)
      if (url.pathname === "/api/v1/schedule/transfer") {
        const existing = [...data.shipments, ...allRuns.flatMap(run => run.shipments)].find(row => row.shipment_id === body.shipment_id)!
        data.shipments = data.shipments.filter(row => row.shipment_id !== body.shipment_id)
        allRuns.forEach(run => { run.shipments = run.shipments.filter(row => row.shipment_id !== body.shipment_id) })
        existing.source_run_id = body.target_run_id
        if (body.target_run_id) allRuns.find(run => run.run_id === body.target_run_id)!.shipments.push(existing)
        else data.shipments.push(existing)
        return envelope(body)
      }
      if (url.pathname === "/api/v1/runs" || url.pathname === "/api/v1/schedule/runs") {
        const id = `run-${counter++}`
        const next = { ...run(id, "draft", "08"), driver: body.driver_id ? data.drivers.find(driver => driver.driver_id === body.driver_id)! : null,
          origin: [depot, mine].find(location => location.location_id === body.origin_location_id)!, destination: [depot, mine].find(location => location.location_id === body.destination_location_id)!, planned_start_at: body.planned_start_at, shipments: [] }
        data.trucks.find(truck => truck.vehicle_id === body.vehicle_id)!.runs.push(next)
        return envelope({ run_id: id })
      }
      if (url.pathname.endsWith("/shipments/create") || url.pathname === "/api/v1/shipments") {
        const row = { ...shipment(String(counter++)), reference: body.merchant_order_ref }
        const target = allRuns.find(run => url.pathname.includes(`/runs/${run.run_id}/`))
        if (target) { row.source_run_id = target.run_id; target.shipments.push(row) } else data.shipments.push(row)
        return envelope(row)
      }
      const target = allRuns.find(run => url.pathname.endsWith(`/runs/${run.run_id}`))
      if (target) { target.driver = body.driver_id ? data.drivers.find(driver => driver.driver_id === body.driver_id)! : null; return envelope(target) }
      return envelope({})
    }
    setReady(true)
    return () => { window.fetch = original }
  }, [])
  return <main className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden">{ready && <ScheduleBoard merchantId="fixture-merchant" token="fixture-token" timezone="Africa/Johannesburg" />}</main>
}
