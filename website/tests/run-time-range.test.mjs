import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const source = await readFile(new URL("../src/components/runs/run-time-range.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { validateTripRange } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
const start = Date.parse("2026-09-21T10:17:34+02:00"), end = Date.parse("2026-09-22T08:28:12+02:00")

test("accepts exact trip limits and an overnight subrange", () => {
  assert.equal(validateTripRange(start, end, start, end), null)
  assert.equal(validateTripRange(Date.parse("2026-09-21T23:00:00+02:00"), Date.parse("2026-09-22T01:00:00+02:00"), start, end), null)
})
test("rejects times outside trip bounds, reversed/empty ranges and missing input", () => {
  for (const [from, to] of [[start - 1, end], [start, end + 1], [end, start], [start, start], [NaN, end], [start, NaN]]) {
    assert.ok(validateTripRange(from, to, start, end))
  }
})
