import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const source = await readFile(new URL("../src/lib/dwell-time.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const dwellTime = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
)

const csvSource = await readFile(new URL("../src/lib/csv-export.ts", import.meta.url), "utf8")
const csvWithoutDwellImport = csvSource.replace(
  'import { formatDurationMinutes, resolveDwellTime } from "@/lib/dwell-time"',
  ""
)
const compiledCsv = ts.transpileModule(`${source}\n${csvWithoutDwellImport}`, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const csvExport = await import(
  `data:text/javascript;base64,${Buffer.from(compiledCsv).toString("base64")}`
)

const at = (minutes) => new Date(Date.UTC(2026, 7, 29, 8, minutes)).toISOString()

test("completed dwell alerts only when exact elapsed time is above the threshold", () => {
  assert.equal(dwellTime.resolveDwellTime({ enteredAt: at(0), exitedAt: at(9), expectedWaitingTime: 10 }).isOverExpected, false)
  assert.equal(dwellTime.resolveDwellTime({ enteredAt: at(0), exitedAt: at(10), expectedWaitingTime: 10 }).isOverExpected, false)
  assert.equal(dwellTime.resolveDwellTime({ enteredAt: at(0), exitedAt: "2026-08-29T08:10:01.000Z", expectedWaitingTime: 10 }).isOverExpected, true)
})

test("null and missing thresholds do not alert while zero remains active", () => {
  assert.equal(dwellTime.resolveDwellTime({ enteredAt: at(0), exitedAt: at(20), expectedWaitingTime: null }).isOverExpected, false)
  assert.equal(dwellTime.resolveDwellTime({ enteredAt: at(0), exitedAt: at(20) }).isOverExpected, false)
  assert.equal(dwellTime.resolveDwellTime({ enteredAt: at(0), exitedAt: at(0), expectedWaitingTime: 0 }).isOverExpected, false)
  assert.equal(dwellTime.resolveDwellTime({ enteredAt: at(0), exitedAt: "2026-08-29T08:00:01.000Z", expectedWaitingTime: 0 }).isOverExpected, true)
})

test("invalid or negative intervals do not render durations or alerts", () => {
  for (const result of [
    dwellTime.resolveDwellTime({ enteredAt: "invalid", exitedAt: at(10), expectedWaitingTime: 0 }),
    dwellTime.resolveDwellTime({ enteredAt: at(10), exitedAt: at(0), expectedWaitingTime: 0 }),
    dwellTime.resolveDwellTime({ enteredAt: null, exitedAt: at(10), expectedWaitingTime: 0 }),
  ]) {
    assert.equal(result.durationLabel, "-")
    assert.equal(result.isOverExpected, false)
  }
})

test("open dwell uses the supplied current time and reports positive overage", () => {
  const result = dwellTime.resolveDwellTime({
    enteredAt: at(0),
    exitedAt: null,
    now: at(16),
    expectedWaitingTime: 15,
  })

  assert.equal(result.isOpen, true)
  assert.equal(result.durationLabel, "16 min")
  assert.equal(result.isOverExpected, true)
  assert.equal(result.overageMinutes, 1)
})

test("duration rounding never produces a 60-minute remainder", () => {
  assert.equal(dwellTime.formatDurationMinutes(59.6), "1 hr")
  assert.equal(dwellTime.formatDurationMinutes(119.6), "2 hr")
  assert.equal(dwellTime.formatDurationMinutes(60.4), "1 hr")
  assert.equal(dwellTime.formatDurationMinutes(60.6), "1 hr 1 min")
})

test("minute wording is singular and plural", () => {
  assert.equal(dwellTime.formatMinuteCount(1), "1 minute")
  assert.equal(dwellTime.formatMinuteCount(2), "2 minutes")
})

test("location CSV uses only the expected waiting-time heading", () => {
  const [row] = csvExport.mapLogisticsCsvRows("locations", [
    { location_id: "location-1", expected_waiting_time: 15 },
  ])

  assert.equal(row.expected_waiting_time, 15)
  assert.equal("estimated_waiting_time" in row, false)
})

test("shipment report CSV keeps duration text without threshold or alert fields", () => {
  const [row] = csvExport.mapLogisticsCsvRows("shipment-report", [
    {
      shipment_id: "shipment-1",
      from_time_in: at(0),
      from_time_out: at(35),
      from_location: { expected_waiting_time: 10 },
    },
  ])

  assert.equal(row.from_total_time, "35 min")
  assert.equal("from_location_expected_waiting_time" in row, false)
  assert.equal("from_overage" in row, false)
})

test("shipment report CSV refreshes open dwell duration at export time", () => {
  const enteredAt = new Date(Date.now() - 90_000).toISOString()
  const [row] = csvExport.mapLogisticsCsvRows("shipment-report", [
    {
      shipment_id: "shipment-open",
      from_time_in: enteredAt,
      from_time_out: null,
      from_total_time: "stale value",
    },
  ])

  assert.notEqual(row.from_total_time, "stale value")
  assert.match(row.from_total_time, /^(?:< 1 min|\d+ min|\d+ hr(?: \d+ min)?)$/)
})
