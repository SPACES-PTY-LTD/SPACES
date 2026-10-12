import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"
const markers = await readFile(new URL("../src/components/runs/run-map-markers.ts", import.meta.url), "utf8")
const timing = (await readFile(new URL("../src/components/runs/run-stop-timing.ts", import.meta.url), "utf8")).replace('import { elapsed } from "@/components/runs/run-map-markers"', "")
const compiled = ts.transpileModule(`${markers}\n${timing}`, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { runStopTiming } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
const exitVisitSource = await readFile(new URL("../src/components/shipments/shipment-exit-visit.ts", import.meta.url), "utf8")
const exitVisitCompiled = ts.transpileModule(exitVisitSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { shipmentExitVisit } = await import(`data:text/javascript;base64,${Buffer.from(exitVisitCompiled).toString("base64")}`)
const start = "2026-10-09T08:00:00Z"
const stop = (end, expected) => ({ entered_at: start, exited_at: end, location: { expected_waiting_time: expected } })

test("tooltip explains total, expected and exact excess", () => {
  const result = runStopTiming(stop("2026-10-09T09:15:30Z", 60))
  assert.equal(result.durationLabel, "1h 15m 30s")
  assert.match(result.tooltip, /was 1h 15m 30s/)
  assert.match(result.tooltip, /60 minutes by 15m 30s/)
})
test("strict thresholds include seconds and zero allowances", () => {
  assert.equal(runStopTiming(stop("2026-10-09T09:00:00Z", 60)).tooltip, null)
  assert.match(runStopTiming(stop("2026-10-09T09:00:01Z", 60)).tooltip, /by 1s/)
  assert.equal(runStopTiming(stop(start, 0)).durationLabel, "0s")
  assert.equal(runStopTiming(stop(start, 0)).tooltip, null)
  assert.match(runStopTiming(stop("2026-10-09T08:00:01Z", 0)).tooltip, /0 minutes by 1s/)
})
test("invalid allowances retain the duration without warnings", () => {
  for (const expected of [null, undefined, -1, NaN, Infinity]) {
    assert.deepEqual(runStopTiming(stop("2026-10-09T09:00:00Z", expected)), { durationLabel: "1h", tooltip: null })
  }
})
test("incomplete and invalid intervals never invent durations", () => {
  for (const input of [stop(null, 0), stop("bad", 0), stop("2026-10-09T07:59:00Z", 0), { ...stop(start, 0), entered_at: null }, { occurred_at: start, exited_at: "2026-10-09T09:00:00Z" }]) {
    assert.deepEqual(runStopTiming(input), { durationLabel: "Not available", tooltip: null })
  }
})
test("offsets and multi-day visits retain elapsed time", () => {
  const result = runStopTiming({ entered_at: "2026-10-09T10:00:00+02:00", exited_at: "2026-10-11T08:00:01Z", location: { expected_waiting_time: 60 } })
  assert.equal(result.durationLabel, "2d 1s")
  assert.match(result.tooltip, /by 1d 23h 1s/)
})

test("shipment exits use recorded visit metadata without pairing unrelated events", () => {
  const exit = { event_type: "exited_location", entered_at: null, exited_at: null, location: { expected_waiting_time: 60 }, metadata: { entered_at: start, exited_at: "2026-10-09T09:00:01Z" } }
  assert.equal(runStopTiming(shipmentExitVisit(exit)).durationLabel, "1h 1s")
  assert.match(runStopTiming(shipmentExitVisit(exit)).tooltip, /by 1s/)
  assert.equal(exit.entered_at, null)
  assert.deepEqual(runStopTiming(shipmentExitVisit({ ...exit, metadata: null })), { durationLabel: "Not available", tooltip: null })
  const direct = stop("2026-10-09T08:30:00Z", 60)
  assert.deepEqual(runStopTiming(shipmentExitVisit(direct)), { durationLabel: "30m", tooltip: null })
})
