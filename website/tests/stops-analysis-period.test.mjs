import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const source = await readFile(new URL("../src/components/reports/stops-analysis-period.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace('"date-fns"', JSON.stringify(import.meta.resolve("date-fns")))
const { normalizeStopAnalysisPeriod, stopAnalysisPeriodBounds } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
const now = new Date("2026-10-12T12:34:56.000Z")

test("hour and week presets retain exact time and duration", () => {
  for (const [period, hours] of [["24h", 24], ["48h", 48], ["7d", 168], ["14d", 336]]) {
    const bounds = stopAnalysisPeriodBounds(period, now)
    assert.equal(new Date(bounds.occurred_to) - new Date(bounds.occurred_from), hours * 3_600_000)
    assert.equal(bounds.occurred_to, now.toISOString())
  }
})
test("month presets use calendar months and clamp short month ends", () => {
  for (const [period, expected] of [["1m", "2026-09-12"], ["3m", "2026-07-12"], ["6m", "2026-04-12"]]) {
    assert.equal(stopAnalysisPeriodBounds(period, now).occurred_from, `${expected}T12:34:56.000Z`)
  }
  assert.equal(stopAnalysisPeriodBounds("1m", new Date("2026-03-31T12:00:00Z")).occurred_from, "2026-02-28T12:00:00.000Z")
})
test("default, invalid and legacy custom links resolve consistently", () => {
  assert.equal(normalizeStopAnalysisPeriod("", false), "24h")
  assert.equal(normalizeStopAnalysisPeriod("invalid", false), "24h")
  assert.equal(normalizeStopAnalysisPeriod("", true), "custom")
  assert.equal(normalizeStopAnalysisPeriod("7d", true), "7d")
  assert.deepEqual(stopAnalysisPeriodBounds("custom", now), {})
})
