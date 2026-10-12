import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"
const dwell = await readFile(new URL("../src/lib/dwell-time.ts", import.meta.url), "utf8")
const source = (await readFile(new URL("../src/components/runs/shipment-location-time.ts", import.meta.url), "utf8")).replace('import { formatDurationMinutes } from "@/lib/dwell-time"', "")
const compiled = ts.transpileModule(`${dwell}\n${source}`, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { shipmentLocationTime } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
const options = { now: "2026-10-12T12:00:00Z", startedAt: "2026-10-12T09:00:00Z", isActive: true, vehicleId: "truck" }
const visit = (start, end, extra = {}) => ({ event_type: "entered_location", location: { location_id: "depot" }, vehicle: { vehicle_id: "truck" }, entered_at: `2026-10-12T${start}:00Z`, exited_at: end ? `2026-10-12T${end}:00Z` : null, ...extra })
test("sum separate visits and merge duplicate/overlapping observations", () => {
  assert.deepEqual(shipmentLocationTime([visit("09:00", "10:00"), visit("09:00", "10:00"), visit("09:30", "10:30"), visit("11:00", "11:30")], "depot", options), { label: "2 hr", isOpen: false })
})
test("open visits update and completed runs stop at completion", () => {
  const visits = [visit("10:00", null)]
  assert.deepEqual(shipmentLocationTime(visits, "depot", options), { label: "2 hr", isOpen: true })
  assert.equal(shipmentLocationTime(visits, "depot", { ...options, now: "2026-10-12T12:30:00Z" }).label, "2 hr 30 min")
  assert.deepEqual(shipmentLocationTime(visits, "depot", { ...options, isActive: false, completedAt: "2026-10-12T11:00:00Z" }), { label: "1 hr", isOpen: false })
  assert.equal(shipmentLocationTime(visits, "depot", { ...options, isActive: false }).label, "Not available")
})
test("identity, event and timestamp guards exclude unrelated or invalid data", () => {
  const visits = [visit("10:00", "11:00", { event_type: "shipment_delivery" }), visit("10:00", "11:00", { vehicle: { vehicle_id: "other" } }), visit("11:00", "10:00"), visit("10:00", "11:00", { entered_at: "invalid" })]
  assert.equal(shipmentLocationTime(visits, "depot", options).label, "Not available")
  assert.equal(shipmentLocationTime([visit("10:00", "11:00")], "other", options).label, "Not available")
  assert.equal(shipmentLocationTime([], undefined, options).label, "Not available")
})
test("clip to run boundaries and retain zero duration", () => {
  assert.equal(shipmentLocationTime([visit("08:00", "11:00")], "depot", { ...options, completedAt: "2026-10-12T10:00:00Z" }).label, "1 hr")
  assert.equal(shipmentLocationTime([visit("10:00", "10:00")], "depot", options).label, "0 min")
})
