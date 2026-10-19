import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"
const source = await readFile(new URL("../src/components/runs/recorded-stop-automation.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { parseRecordedAutomation: parse, automationTimestamp } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)

test("absent and malformed records cannot produce Explain entries", () => {
  for (const value of [null, {}, [], { automation: {} }, { automation: [null, [], {}, { action: {} }, { action: "toString" }, { action: "unknown" }] }]) assert.deepEqual(parse(value), [])
})
test("preserves separate entry and exit executions in stored order", () => {
  const actions = parse({ automation: [
    { action: "record_vehicle_entry", event: "entry", conditions: [], executed_at: "2026-10-19T08:00:00Z" },
    { action: "record_vehicle_exit", event: "exit", conditions: [], executed_at: "2026-10-19T09:00:00Z" },
  ] })
  assert.deepEqual(actions.map(a => a.trigger), ["On entry", "On exit"])
  assert.equal(actions[0].conditionsUnavailable, false)
  assert.equal(actions[1].action, "Record vehicle exit")
})
test("formats historical condition snapshots without current settings", () => {
  const metadata = { automation: [{ action: "start_run", event: "entry", conditions: [
    { field: "has_active_run", operator: "equals", value: "true" },
    { field: "run_status", operator: "not_equals", value: "in_progress" },
  ] }] }
  const before = JSON.stringify(metadata)
  assert.deepEqual(parse(metadata)[0].conditions, ["Has active run is Yes", "Run status is not in progress"])
  assert.equal(parse(metadata)[0].action, "End run & start new run")
  assert.equal(JSON.stringify(metadata), before)
})
test("older incomplete conditions and invalid timestamps stay explicitly unavailable", () => {
  for (const extra of [{}, { conditions: [], has_conditions: true }, { conditions: [null] }, { conditions: [], condition_count: 2 }]) {
    const [entry] = parse({ automation: [{ action: "create_shipment", executed_at: "invalid", ...extra }] })
    assert.equal(entry.conditionsUnavailable, true)
    assert.equal(entry.executedAt, null)
    assert.equal(entry.trigger, "Trigger not recorded")
  }
  assert.equal(automationTimestamp(null), "Time not recorded")
  assert.equal(automationTimestamp("invalid"), "Time not recorded")
  assert.equal(parse({ automation: [{ action: "create_shipment", has_conditions: false }] })[0].conditionsUnavailable, false)
})
