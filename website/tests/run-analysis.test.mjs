import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const report = { conclusion: 'Awaiting dispatch closure.', expected_ending: 'Dispatch must approve.', observed_ending: 'Still active.', limitations: ['No duration target.'], red_flags: [], missing_locations: [{ candidate_id: 'candidate', suggested_name: 'Review stop', reason: 'Unmatched important stop.', location_type_id: null }] };
const saved = { analysis_id: 'saved', status: 'completed', report, completed_at: '2026-10-14T06:00:00Z', as_of: '2026-10-14T05:59:00Z', timezone: 'Africa/Johannesburg', evidence: [] };
function harness(initial = {}) {
  let cursor = 0, tree, hidden = false; const slots = [], effects = [], timers = [], calls = [];
  const data = { latest: null, saved: null, stale: false, can_analyze: true, can_create_location: true, configured: true, ...initial };
  const react = {
    useState(value) { const i = cursor++; slots[i] ??= { value }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; },
    useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i]; },
    useEffect(effect, deps) { const i = cursor++; if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) { slots[i]?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = effect(); }); } },
  };
  const jsx = (type, props) => ({ type, props });
  const modules = { react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, '@/lib/api/client': { isApiErrorResponse: value => !!value?.error }, '@/lib/api/run-analysis': {
    getRunAnalysis: async (...args) => { calls.push(['get', ...args]); return { data: structuredClone(data) }; },
    analyzeRun: async (...args) => { calls.push(['start', ...args]); data.latest = { analysis_id: 'new', status: 'queued' }; return { data: data.latest }; },
    prefillAnalysisLocation: async (...args) => { calls.push(['prefill', ...args]); return { data: { existing_location_id: null, initial_values: { name: 'Review stop', latitude: -26, longitude: 28 } } }; },
  } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/runs/run-analysis-card.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require: name => modules[name] ?? new Proxy({}, { get: (_, name) => name }), Date, Intl, Error, AbortController,
    document: { get visibilityState() { return hidden ? 'hidden' : 'visible'; }, addEventListener() {}, removeEventListener() {} },
    crypto: { randomUUID: () => 'request-key' }, window: { setInterval: fn => timers.push(fn), clearInterval() {} },
  });
  const render = () => { cursor = 0; tree = exports.RunAnalysisCard({ runId: 'run', merchantId: 'merchant', environmentId: 'environment', token: 'token' }); effects.splice(0).forEach(fn => fn()); };
  const nodes = (node = tree) => Array.isArray(node) ? node.flatMap(n => nodes(n ?? null)) : !node || typeof node !== 'object' ? [] : [node, ...nodes(node.props?.children ?? null)];
  const text = node => Array.isArray(node) ? node.map(text).join('') : !node || typeof node !== 'object' ? String(node ?? '') : text(node.props?.children);
  const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); render(); };
  render();
  return { data, calls, render, nodes, text, tick, find: fn => nodes().find(fn), async click(label) { const button = nodes().find(n => n.type === 'Button' && text(n) === label); assert.ok(button, label); await button.props.onClick(); await tick(); }, hidden(value) { hidden = value; }, poll() { timers.forEach(fn => fn()); } };
}
test('analysis queues once, polls only visible, and saved result survives reopening', async () => {
  const app = harness(); await app.tick(); await app.click('Analyze using AI');
  assert.equal(app.calls.filter(c => c[0] === 'start').length, 1);
  assert.ok(app.text(app.find(n => n.props?.role === 'status')).includes('Analyzing run data'));
  const count = app.calls.length; app.hidden(true); app.poll(); await app.tick(); assert.equal(app.calls.length, count);
  app.hidden(false); app.data.latest = saved; app.data.saved = saved; app.poll(); await app.tick();
  assert.ok(app.find(n => n.type === 'Button' && app.text(n) === 'Re-analyze run'));
  const reopened = harness({ latest: saved, saved }); await reopened.tick(); assert.ok(reopened.text(reopened.find(n => n.type === 'Card')).includes(report.conclusion));
});
test('failed reanalysis keeps the successful report', async () => {
  const app = harness({ latest: saved, saved }); await app.tick(); await app.click('Re-analyze run');
  assert.ok(app.text(app.find(n => n.type === 'Card')).includes(report.conclusion));
  app.data.latest = { analysis_id: 'new', status: 'failed', error: 'Try again.' }; app.poll(); await app.tick();
  assert.ok(app.find(n => n.props?.role === 'alert')); assert.ok(app.text(app.find(n => n.type === 'Card')).includes(report.conclusion));
});
test('location recommendation only prepares a scoped draft and explicit save marks report outdated', async () => {
  const app = harness({ latest: saved, saved }); await app.tick(); await app.click('Create location');
  const form = app.find(n => n.type === 'LocationDialog');
  assert.equal(form.props.initializeFallbackTypes, false); assert.equal(form.props.open, true); assert.equal(form.props.lockMerchant, true); assert.equal(form.props.merchantId, 'merchant'); assert.equal(form.props.environmentId, 'environment');
  assert.equal(form.props.initialValues.latitude, -26); assert.equal(form.props.initialValues.name, 'Review stop');
  assert.equal(app.calls.filter(c => !['get', 'prefill'].includes(c[0])).length, 0);
  form.props.onSaved({ location_id: 'new-location' }); await app.tick();
  assert.equal(app.find(n => n.type === 'LocationDetailsDrawer').props.locationId, 'new-location');
  assert.ok(app.text(app.find(n => n.type === 'Card')).includes('have changed'));
});
test('view-only access retains reports but cannot generate or create locations', async () => {
  const app = harness({ latest: saved, saved, can_analyze: false, can_create_location: false }); await app.tick();
  assert.ok(app.text(app.find(n => n.type === 'Card')).includes(report.conclusion));
  assert.equal(app.nodes().some(n => n.type === 'Button' && ['Analyze using AI', 'Re-analyze run', 'Create location'].includes(app.text(n))), false);
});
