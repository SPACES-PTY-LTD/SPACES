import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(path, modules, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => modules[name] ?? new Proxy({}, { get: (_, key) => key }), Error, ...globals });
  return exports;
}
const utils = compile('../src/components/runs/run-action-utils.ts', {});
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function harness() {
  let cursor = 0, tree, refreshes = 0;
  const slots = [], requests = [], effects = [], paths = [];
  const run = { run_id: 'run', merchant_id: 'merchant', driver: { driver_id: 'driver' }, can_edit_endpoints: true, can_update_delivery_order: true, can_message_driver: true };
  const router = { refresh: () => refreshes++, push: path => paths.push(path) };
  const hooks = {
    useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
    useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
    useEffect(fn) { const i = cursor++; if (!slots[i]) { slots[i] = {}; effects.push(() => { slots[i].cleanup = fn(); }); } },
  };
  const jsx = (type, props) => ({ type, props });
  const modules = { react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'next/navigation': { useRouter: () => router },
    '@/lib/api/client': { isApiErrorResponse: r => !!r.error, apiFetch: (path, options) => new Promise((resolve, reject) => requests.push({ path, options, resolve, reject })) },
    '@/lib/api/runs': { getRun: () => new Promise((resolve, reject) => requests.push({ path: 'getRun', resolve, reject })) },
    './run-action-utils': utils, sonner: { toast: { success() {} } },
  };
  const { AdminRunActions } = compile('../src/components/runs/admin-run-actions.tsx', modules, { URLSearchParams, crypto: { randomUUID: () => 'handoff' } });
  function render() { cursor = 0; tree = AdminRunActions({ run, token: 'token' }); effects.splice(0).forEach(fn => fn()); }
  function nodes(node = tree) { if (Array.isArray(node)) return node.flatMap(item => nodes(item)); if (!node || typeof node !== 'object') return []; return [node, ...nodes(node.props?.children ?? null)]; }
  function text(node) { if (Array.isArray(node)) return node.map(text).join(''); if (typeof node !== 'object' || !node) return String(node ?? ''); return text(node.props?.children); }
  function find(label) { return nodes().find(node => text(node) === label && (node.props.onClick || node.props.onSelect)); }
  render();
  return { run, requests, paths, nodes, find, render, get tree() { return tree; }, get refreshes() { return refreshes; },
    async flush() { await tick(); render(); }, click(label) { const node = find(label); assert.ok(node, label); assert.ok(!node.props.disabled, `${label} enabled`); (node.props.onClick ?? node.props.onSelect)(); render(); },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
}

test('edit uses stored endpoints, retains failed drafts and requires reload on conflict', async () => {
  const app = harness(); app.click('Edit run');
  app.requests[0].resolve({ ...app.run, planned_origin: null, planned_destination: null, origin: { location_id: 'fallback' } }); await app.flush();
  let pickers = app.nodes().filter(node => node.type === 'LocationCombobox'); assert.equal(pickers[0].props.value, null);
  pickers[0].props.onChange({ location_id: 'start' }); pickers[1].props.onChange({ location_id: 'end' }); app.render();
  app.click('Save locations'); assert.equal(app.requests[1].options.body.expected_origin_location_id, null);
  app.requests[1].resolve({ error: true, message: 'Offline', status: 503 }); await app.flush();
  assert.equal(app.nodes().find(node => node.type === 'LocationCombobox').props.value.location_id, 'start');
  app.click('Save locations'); app.requests[2].resolve({ error: true, message: 'Changed', status: 409 }); await app.flush();
  assert.equal(app.find('Save locations').props.disabled, true);
  app.click('Reload run locations'); app.requests[3].resolve({ ...app.run, planned_origin: { location_id: 'new' }, planned_destination: { location_id: 'end' } }); await app.flush();
  assert.equal(app.nodes().find(node => node.type === 'LocationCombobox').props.value.location_id, 'new');
});

test('delivery buttons and drag produce the same order, send baseline and refresh after save', async () => {
  const app = harness(); app.click('Update delivery order');
  app.requests[0].resolve({ data: { shipments: [{ shipment_id: 'a', reference: 'A' }, { shipment_id: 'b', reference: 'B' }] } }); await app.flush();
  assert.equal(app.find('Save delivery order').props.disabled, true);
  app.nodes().find(node => node.props['aria-label'] === 'Move B earlier').props.onClick(); app.render();
  const handle = app.nodes().find(node => node.props['aria-label'] === 'Drag B');
  handle.props.onDragStart({ dataTransfer: { setData() {} } }); app.render();
  assert.equal(app.find('Save delivery order').props.disabled, true);
  app.nodes().filter(node => node.type === 'li' && node.props.onDrop)[1].props.onDrop({ preventDefault() {} }); app.render();
  assert.equal(app.find('Save delivery order').props.disabled, true);
  app.nodes().find(node => node.props['aria-label'] === 'Move B earlier').props.onClick(); app.render(); app.click('Save delivery order');
  assert.deepEqual(Array.from(app.requests[1].options.body.shipment_ids), ['b', 'a']);
  assert.deepEqual(Array.from(app.requests[1].options.body.expected_shipment_ids), ['a', 'b']);
  app.requests[1].resolve({ data: {} }); await app.flush(); assert.equal(app.refreshes, 1);
});

test('permission flags hide editing and missing driver disables messaging with explanation', () => {
  const app = harness(); app.run.can_edit_endpoints = false; app.run.can_update_delivery_order = false; app.run.driver = null; app.render();
  assert.equal(app.find('Edit run'), undefined); assert.equal(app.find('Update delivery order'), undefined);
  assert.equal(app.find('Message the driver').props.disabled, true);
  app.run.driver = { driver_id: 'driver' }; app.render(); app.click('Message the driver');
  assert.match(app.paths[0], /merchant_id=merchant&run_id=run&handoff=handoff/);
});

test('unmount discards a late save response', async () => {
  const app = harness(); app.click('Update delivery order');
  app.requests[0].resolve({ data: { shipments: [{ shipment_id: 'a', reference: 'A' }, { shipment_id: 'b', reference: 'B' }] } }); await app.flush();
  app.nodes().find(node => node.props['aria-label'] === 'Move B earlier').props.onClick(); app.render(); app.click('Save delivery order'); app.unmount();
  app.requests[1].resolve({ data: {} }); await tick(); assert.equal(app.refreshes, 0);
});

function handoffHarness() {
  const slots = [], effects = [], requests = [], opened = [], errors = [];
  let cursor = 0, cleaned = 0;
  const props = { runId: 'run', handoff: 'once', merchant: 'merchant', token: 'token' };
  const onOpen = (...args) => opened.push(args), onError = e => errors.push(e), onMerchant = value => { props.merchant = value; };
  const { useRunMessageHandoff } = compile('../src/components/messages/use-run-message-handoff.ts', {
    react: { useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
      useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((d, j) => d !== slots[i].deps[j])) { slots[i]?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); }); } } },
    '@/lib/api/runs': { getRun: () => new Promise(resolve => requests.push({ kind: 'run', resolve })) },
    '@/lib/api/conversations': { conversationRequest: (_, path, method, body) => new Promise((resolve, reject) => requests.push({ path, method, body, resolve, reject })) },
    '@/lib/api/client': { isApiErrorResponse: r => !!r.error },
  }, { URL, window: { location: { href: 'http://localhost/admin/messages?run_id=run&handoff=once' }, history: { replaceState() { cleaned++; } } } });
  function render() { cursor = 0; useRunMessageHandoff(props.runId, props.handoff, props.merchant, props.token, onOpen, onError, onMerchant); effects.splice(0).forEach(fn => fn()); }
  render();
  return { props, requests, opened, errors, render, get cleaned() { return cleaned; }, async flush() { await tick(); render(); }, resolveRun(i = 0, extra = {}) { requests[i].resolve({ run_id: 'run', merchant_id: 'merchant', can_message_driver: true, driver: { driver_id: 'driver' }, ...extra }); } };
}

test('run handoff opens assigned driver chat and drafts one attachment without sending', async () => {
  const app = handoffHarness(); app.resolveRun(); await app.flush();
  assert.equal(app.requests[1].path, '/driver'); assert.equal(app.requests[1].body.driver_id, 'driver');
  app.requests[1].resolve({ data: { status: 'active', conversation_id: 'chat' } }); await app.flush();
  assert.equal(app.opened.length, 1); assert.equal(app.opened[0][1].id, 'run'); assert.equal(app.cleaned, 1);
  app.render(); assert.equal(app.requests.length, 2);
});

test('closed and deleted chats never receive a draft or automatic message', async () => {
  const app = handoffHarness(); app.resolveRun(); await app.flush();
  app.requests[1].resolve({ data: { status: 'closed' } }); await app.flush(); assert.equal(app.opened[0][1], null);
  const deleted = handoffHarness(); deleted.resolveRun(); await deleted.flush(); deleted.requests[1].reject(new Error('Deleted')); await deleted.flush();
  assert.equal(deleted.opened.length, 0); assert.equal(deleted.errors[0], 'Deleted');
});

test('handoff validates merchant and assignment and ignores old-session responses', async () => {
  for (const extra of [{ merchant_id: null }, { driver: null }, { can_message_driver: false }]) {
    const app = handoffHarness(); app.resolveRun(0, extra); await app.flush(); assert.equal(app.requests.length, 1); assert.equal(app.errors.length, 1);
  }
  const app = handoffHarness(); app.props.token = 'new-session'; app.render(); app.resolveRun(0); await app.flush();
  assert.equal(app.requests.length, 2); assert.equal(app.opened.length, 0);
});

test('handoff switches an already open inbox to the run merchant before opening the chat', async () => {
  const app = handoffHarness(); app.props.merchant = 'previous'; app.render();
  app.resolveRun(1); await app.flush(); assert.equal(app.props.merchant, 'merchant');
  app.resolveRun(2); await app.flush(); assert.equal(app.requests[3].body.merchant_id, 'merchant');
});
