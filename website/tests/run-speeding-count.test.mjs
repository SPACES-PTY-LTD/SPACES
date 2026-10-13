import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

async function moduleFrom(source) {
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
}
const source = await readFile(new URL("../src/lib/run-speeding-count.ts", import.meta.url), "utf8")
const { runSpeedingCount } = await moduleFrom(source)

test("summary counts accept numbers and numeric strings and preserve explicit zero", () => {
  for (const count of [0, 1, 27, "0", "2", " 12 "]) assert.equal(runSpeedingCount({ speeding_alert_count: count }), Number(count))
  assert.equal(runSpeedingCount({ speeding_alert_count: 0, safety: { speeding_event_count: 2 } }), 0)
})
test("legacy full run safety counts include events without coordinates", () => {
  assert.equal(runSpeedingCount({ safety: { speeding_event_count: 3 } }), 3)
  assert.equal(runSpeedingCount({ safety: { speeding_events: [{ latitude: null }, {}] } }), 2)
  assert.equal(runSpeedingCount({ safety: { speeding_events: [] } }), 0)
})
test("missing or malformed telemetry stays unknown rather than inventing zero", () => {
  for (const count of [undefined, null, "", " ", "bad", -1, Infinity, NaN, 1.2, true]) {
    assert.equal(runSpeedingCount({ speeding_alert_count: count }), null)
  }
})

const apiSource = await readFile(new URL("../src/lib/api/runs.ts", import.meta.url), "utf8")
async function listWith(responses, params) {
  const body = apiSource.replace(/^import .*$/gm, "")
  const { listRuns, calls } = await moduleFrom(`const runSpeedingCount = ${runSpeedingCount.toString()};\nconst calls = [];\nconst responses = ${JSON.stringify(responses)};\nconst apiFetch = async (path, options) => { calls.push(options.params); return responses.shift(); };\nconst isApiErrorResponse = value => value.error === true;\nexport { calls };\n${body}`)
  return { response: await listRuns("token", params), calls }
}
test("legacy summary fallback matches by UUID and retains original pagination", async () => {
  const { response, calls } = await listWith([
    { data: [{ run_id: "a" }, { run_id: "b", speeding_alert_count: 0 }], meta: { total: 15 } },
    { data: [{ run_id: "b", safety: { speeding_event_count: 4 } }, { run_id: "a", safety: { speeding_event_count: 2 } }] },
  ], { summary: true, page: 2, per_page: 2 })
  assert.equal(response.data[0].speeding_alert_count, 2)
  assert.equal(response.data[1].speeding_alert_count, 0)
  assert.equal(response.meta.total, 15)
  assert.deepEqual(calls, [{ summary: true, page: 2, per_page: 2 }, { summary: false, page: 2, per_page: 2 }])
})
test("summary errors and failed compatibility reads preserve the original response", async () => {
  const response = { data: [{ run_id: "a" }] }
  assert.deepEqual((await listWith([response, { error: true }], { summary: true })).response, response)
  assert.deepEqual((await listWith([{ error: true }], { summary: true })).response, { error: true })
})

test("current summary counts keep the lightweight single-request path, including zero", async () => {
  const result = await listWith([{ data: [{ run_id: "a", speeding_alert_count: 0 }, { run_id: "b", speeding_alert_count: "2" }] }], { summary: true })
  assert.equal(result.calls.length, 1)
})

const pageSource = await readFile(new URL("../src/app/admin/logistics/shipments/runs/page.tsx", import.meta.url), "utf8")
test("Runs table freezes Attention and passes normalized counts to the icon renderer", async () => {
  const source = pageSource.replace(/^import .*$/gm, "")
  const stubs = `
    const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
    const Button = 'Button', DataTable = 'DataTable', Input = 'Input', PageHeader = 'PageHeader';
    const requireAuth = async () => ({ accessToken: 'test', user: { role: 'super_admin' } });
    const getScopedMerchantId = () => undefined;
    const isApiErrorResponse = value => value.error === true;
    const listRuns = async () => ({ data: [{ run_id: 'a', speeding_alert_count: '2' }, { run_id: 'b', speeding_alert_count: 0 }] });
    const AdminRoute = { runDetails: id => '/runs/' + id };
    const normalizeTableMeta = value => value;
    const runSpeedingCount = ${runSpeedingCount.toString()};
  `
  const compiled = ts.transpileModule(stubs + source, { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText
  const { default: page } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
  const rendered = await page({})
  const table = rendered.props.children.find(node => node.type === "DataTable")
  assert.equal(table.props.stickyColumns.leading, 3)
  assert.equal(table.props.columns[2].key, "attention")
  assert.equal(table.props.columns[2].type, "shipment_attention")
  assert.equal(table.props.data[0].speeding_alert_count, 2)
  assert.equal(table.props.data[1].speeding_alert_count, 0)
})
