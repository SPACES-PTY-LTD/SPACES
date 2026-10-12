import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"
const source = await readFile(new URL("../src/components/reports/stops-analysis-visits.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { buildStopAnalysisRows, buildStopAnalysisDetails } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
const at = (m) => new Date(Date.UTC(2026, 9, 12, 10, m)).toISOString()
const entry = (start, end, extra = {}) => ({ event_type: "entered_location", vehicle_id: "truck-1", location_id: "stop-1", entered_at: at(start), exited_at: end === null ? null : at(end), ...extra })

test("repeated open entries count once across runs, shipments and input order", () => {
  const [row] = buildStopAnalysisRows([entry(10, null, { run_id: "run-2" }), entry(0, null), entry(5, null, { shipment: { shipment_id: "shipment-2" } })])
  assert.equal(row.visitCount, 1)
  assert.equal(row.openVisits, 1)
  assert.equal(row.averageDwellMinutes, null)
  assert.equal(row.latestVisitAt, at(0))
})
test("overlapping duplicates share one duration; departure and return create another visit", () => {
  const [row] = buildStopAnalysisRows([entry(30, 40), entry(0, 20), entry(5, 25), entry(0, null), entry(35, 40)])
  assert.equal(row.visitCount, 2)
  assert.equal(row.openVisits, 0)
  assert.equal(row.averageDwellMinutes, 17.5)
  assert.equal(row.maxDwellMinutes, 25)
  assert.equal(row.latestVisitAt, at(40))
})
test("invalid departure cannot create a return; later valid departure closes the grouped visit", () => {
  const [row] = buildStopAnalysisRows([entry(0, null), entry(10, 5), entry(20, null, { exited_at: "bad" }), entry(25, 30), entry(40, null)])
  assert.equal(row.visitCount, 2)
  assert.equal(row.averageDwellMinutes, 30)
  assert.equal(row.openVisits, 1)
})
test("trucks and locations are independent; missing identity and non-entry events are excluded", () => {
  const rows = buildStopAnalysisRows([entry(0, null), entry(1, null, { vehicle_id: "truck-2" }), entry(2, null, { location_id: "stop-2" }), entry(3, null, { vehicle_id: null }), entry(4, null, { location_id: null }), entry(5, null, { entered_at: "bad" }), entry(6, null, { event_type: "shipment_delivery" })])
  assert.equal(rows.length, 2)
  assert.equal(rows.find(row => row.locationId === "stop-1").visitCount, 2)
  assert.equal(rows.find(row => row.locationId === "stop-1").uniqueVehicleCount, 2)
})
test("occurrence fallback, zero dwell and immediate return preserve departure evidence", () => {
  const [row] = buildStopAnalysisRows([entry(0, 0), entry(0, 0), entry(1, 5, { entered_at: null, occurred_at: at(1) }), entry(5, null)])
  assert.equal(row.visitCount, 3)
  assert.equal(row.averageDwellMinutes, 2)
  assert.equal(row.openVisits, 1)
})


test("location drawer statistics reconcile with report and separate trucks/locations", () => {
  const activities = [entry(0, 20, { vehicle: { vehicle_id: "truck-1", plate_number: "ABC 123" } }), entry(5, 20), entry(30, null), entry(10, 10, { vehicle_id: "truck-2" }), entry(0, null, { location_id: "stop-2" })]
  const details = buildStopAnalysisDetails(activities)
  for (const row of buildStopAnalysisRows(activities)) {
    const detail = details[row.locationId]
    assert.equal(detail.visits.length, row.visitCount)
    assert.equal(detail.vehicles.length, row.uniqueVehicleCount)
    assert.equal(detail.vehicles.reduce((sum, vehicle) => sum + vehicle.visitCount, 0), row.visitCount)
    assert.equal(detail.vehicles.reduce((sum, vehicle) => sum + vehicle.openVisits, 0), row.openVisits)
  }
  const truck = details["stop-1"].vehicles.find(vehicle => vehicle.vehicleId === "truck-1")
  assert.equal(truck.vehicleLabel, "ABC 123")
  assert.equal(truck.totalDwellMinutes, 20)
  assert.equal(truck.averageDwellMinutes, 20)
  assert.equal(truck.openVisits, 1)
  assert.deepEqual(details["stop-1"].visits.map(visit => visit.enteredAt), [at(30), at(10), at(0)])
  assert.equal(details["stop-2"].vehicles[0].totalDwellMinutes, null)
})

test("drawer reflects only the supplied report window, preserving zero dwell and vehicle reference fallback", () => {
  const inRange = entry(30, 30, { vehicle: { vehicle_id: "truck-1", ref_code: "Truck reference" } })
  const details = buildStopAnalysisDetails([inRange, entry(40, null, { vehicle_id: null })])
  assert.deepEqual(Object.keys(details), ["stop-1"])
  assert.equal(details["stop-1"].visits.length, 1)
  assert.equal(details["stop-1"].vehicles[0].vehicleLabel, "Truck reference")
  assert.equal(details["stop-1"].vehicles[0].totalDwellMinutes, 0)
  assert.equal(details["stop-1"].vehicles[0].averageDwellMinutes, 0)
})
