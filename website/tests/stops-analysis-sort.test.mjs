import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const source = await readFile(new URL("../src/components/reports/stops-analysis-sort.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { sortStopAnalysisRows: sort } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)

test("numeric sort preserves source order and keeps missing dwell last both ways", () => {
  const rows = [{ dwell: 100 }, { dwell: null }, { dwell: 9 }, { dwell: 0 }]
  assert.deepEqual(sort(rows, "dwell", "asc").map(r => r.dwell), [0, 9, 100, null])
  assert.deepEqual(sort(rows, "dwell", "desc").map(r => r.dwell), [100, 9, 0, null])
  assert.deepEqual(rows.map(r => r.dwell), [100, null, 9, 0])
})
test("timestamps sort by instant across timezone offsets with open visits last", () => {
  const rows = [{ exitedAt: "2026-10-19T10:00:00+02:00" }, { exitedAt: null }, { exitedAt: "2026-10-19T09:00:00Z" }]
  assert.deepEqual(sort(rows, "exitedAt", "asc"), [rows[0], rows[2], rows[1]])
  assert.deepEqual(sort(rows, "exitedAt", "desc"), [rows[2], rows[0], rows[1]])
})
test("vehicle labels use natural ordering and ties remain stable", () => {
  const rows = [{ vehicleLabel: "Truck 10" }, { vehicleLabel: "truck 2", id: 1 }, { vehicleLabel: "Truck 2", id: 2 }]
  assert.deepEqual(sort(rows, "vehicleLabel", "asc"), [rows[1], rows[2], rows[0]])
})
