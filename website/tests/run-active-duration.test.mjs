import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const source = await readFile(new URL("../src/components/runs/run-active-duration.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { runActiveDuration } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
const start = "2026-10-13T08:00:00Z"

test("active runs count whole minutes from actual start, including time away", () => {
  assert.equal(runActiveDuration("in_progress", start, null, Date.parse("2026-10-13T09:05:59Z")), "1h 5m")
  assert.equal(runActiveDuration("in_progress", start, null, Date.parse("2026-10-15T10:00:00Z")), "50h 0m")
})
test("completed duration stays fixed at completion and understands timezone offsets", () => {
  assert.equal(runActiveDuration("completed", "2026-10-13T10:00:00+02:00", "2026-10-13T09:00:00Z", Date.parse("2026-10-15T09:00:00Z")), "1h 0m")
})
test("missing or invalid evidence never invents an active duration", () => {
  for (const status of ["draft", "dispatched", "completed", "cancelled"]) assert.equal(runActiveDuration(status, start, null, Date.now()), "-")
  assert.equal(runActiveDuration("in_progress", null, null, Date.now()), "-")
  assert.equal(runActiveDuration("in_progress", "invalid", null, Date.now()), "-")
  assert.equal(runActiveDuration("completed", start, "invalid", Date.now()), "-")
  assert.equal(runActiveDuration("completed", start, "2026-10-13T07:00:00Z", Date.now()), "-")
})
test("future active starts clamp to zero and zero-length completion is valid", () => {
  assert.equal(runActiveDuration("in_progress", start, null, Date.parse("2026-10-13T07:59:00Z")), "0h 0m")
  assert.equal(runActiveDuration("completed", start, start, Date.now()), "0h 0m")
})
