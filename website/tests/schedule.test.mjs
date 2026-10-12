import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(path, modules = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => modules[name] ?? new Proxy({}, { get: (_, key) => key }), Date, Intl, Error, Set, Object, ...globals });
  return exports;
}
const utils = compile('../src/components/schedule/schedule-utils.ts');
const shipment = { shipment_id: 'shipment', reference: 'DN-1', status: 'draft', source_run_id: null, pickup: null, dropoff: null };
const driver = { driver_id: 'driver', name: 'Alex', assigned: false };
const planned = { run_id: 'planned', status: 'draft', can_assign_driver: true, can_add_shipment: true, driver: null, shipments: [], origin: null, destination: null };
const active = { ...planned, run_id: 'active', status: 'in_progress', can_assign_driver: false, driver, shipments: [{ ...shipment, source_run_id: 'active' }] };

test('drop eligibility enforces active driver locks, plan-only moves and same-run exclusions', () => {
  assert.equal(utils.eligibleRun({ kind: 'driver', driver }, active), false);
  assert.equal(utils.eligibleRun({ kind: 'driver', driver }, planned), true);
  assert.equal(utils.eligibleRun({ kind: 'shipment', shipment }, active), true);
  assert.equal(utils.eligibleRun({ kind: 'shipment', shipment: { ...shipment, source_run_id: 'source' } }, active), false);
  assert.equal(utils.eligibleRun({ kind: 'shipment', shipment: { ...shipment, source_run_id: 'planned' } }, planned), false);
});
test('merchant wall time and calendar navigation do not use the browser timezone', () => {
  assert.equal(utils.merchantTimeToIso('2026-10-12T08:00', 'Africa/Johannesburg'), '2026-10-12T06:00:00.000Z');
  assert.equal(utils.dateInTimezone(new Date('2026-10-11T22:00:00Z'), 'Africa/Johannesburg'), '2026-10-12');
  assert.equal(utils.shiftDay('2026-12-31', 1), '2027-01-01');
  assert.throws(() => utils.merchantTimeToIso('2026-03-08T02:30', 'America/New_York'), /does not exist/);
});
function harness() {
  const slots = [], effects = [], timers = new Map(), requests = [], writes = [];
  let cursor = 0, tree, timerId = 0;
  const React = {
    useState(initial) { const i = cursor++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; },
    useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
    useEffect(effect, deps) { const i = cursor++; const old = slots[i]; if (!old || deps.some((dep, j) => !Object.is(dep, old.deps[j]))) { old?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = effect(); }); } },
  };
  const jsx = (type, props) => ({ type, props });
  const write = (kind, args) => { writes.push({ kind, args }); return Promise.resolve({ data: {} }); };
  const modules = { react: React, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, './schedule-utils': utils,
    '@/lib/utils': { cn: (...args) => args.filter(Boolean).join(' ') },
    '@/lib/api/client': { isApiErrorResponse: value => !!value?.error, apiFetch: (...args) => write('api', args) },
    '@/lib/api/schedule': { getSchedule: (...args) => new Promise(resolve => requests.push({ args, resolve })), assignScheduledDriver: (...args) => write('driver', args), transferScheduledShipment: (...args) => write('shipment', args), createScheduledRun: (...args) => write('create', args) },
    '@/lib/routes/admin': { AdminRoute: { runDetails: id => id, shipmentDetails: id => id } },
    sonner: { toast: { success() {}, error() {} } },
  };
  const { ScheduleBoard } = compile('../src/components/schedule/schedule-board.tsx', modules, { AbortController, crypto: { randomUUID: () => 'request-id' }, window: {
    setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id), confirm: () => false,
  } });
  const render = () => { cursor = 0; tree = ScheduleBoard({ merchantId: 'merchant', token: 'token', timezone: 'Africa/Johannesburg' }); effects.splice(0).forEach(fn => fn()); };
  const nodes = (node = tree) => Array.isArray(node) ? node.flatMap(child => nodes(child ?? null)) : !node || typeof node !== 'object' ? [] : [node, ...nodes(node.props?.children ?? null)];
  const text = node => Array.isArray(node) ? node.map(text).join('') : !node || typeof node !== 'object' ? String(node ?? '') : text(node.props?.children);
  const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); render(); };
  const timersRun = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); };
  render(); timersRun();
  const data = { timezone: 'Africa/Johannesburg', environments: [], can_manage: true, drivers: [driver], shipments: [shipment], trucks: [
    { vehicle_id: 'truck', plate_number: 'TRUCK', can_create: true, available: false, runs: [active, planned] },
    { vehicle_id: 'empty', plate_number: 'EMPTY', can_create: true, available: true, runs: [] },
  ], pagination: Object.fromEntries(['drivers', 'trucks', 'shipments'].map(key => [key, { current_page: 1, last_page: 1, total: 1 }])) };
  return { data, requests, writes, nodes, text, render, tick, timersRun, find: predicate => nodes().find(predicate), async load() { requests[0].resolve({ data }); await tick(); } };
}

test('shipment assignment into active run sends expected unassigned source and refreshes', async () => {
  const app = harness(); await app.load();
  app.find(n => n.type === 'Button' && app.text(n) === 'Assign to run').props.onClick(); app.render();
  const pick = app.find(n => n.type === 'Button' && app.text(n).startsWith('Active ·'));
  assert.ok(pick); await pick.props.onClick(); await app.tick();
  assert.equal(app.writes[0].kind, 'shipment');
  assert.equal(app.writes[0].args[2].source_run_id, null);
  assert.equal(app.writes[0].args[3], 'active');
  app.timersRun(); assert.equal(app.requests.length, 2);
});
test('dropping a driver on an empty truck opens creation without saving, and cancellation writes nothing', async () => {
  const app = harness(); await app.load();
  app.find(n => n.props?.onDragStart && app.text(n).includes('Alex')).props.onDragStart({ dataTransfer: { setData() {} } }); app.render();
  app.find(n => n.props?.onDrop && app.text(n).includes('EMPTY')).props.onDrop({ preventDefault() {} }); app.render();
  assert.ok(app.find(n => n.type === 'Drawer' && n.props.open && app.text(n).includes('Create run')));
  app.find(n => n.type === 'Button' && app.text(n) === 'Cancel' && n.props.type === 'button').props.onClick(); app.render();
  assert.equal(app.writes.length, 0);
});
test('filter refresh ignores an older response after its request was aborted', async () => {
  const app = harness();
  app.find(n => n.props?.['aria-label'] === 'Toggle search trucks').props.onClick(); app.render();
  app.find(n => n.props?.['aria-label'] === 'Search trucks').props.onChange({ target: { value: 'new' } }); app.render(); app.timersRun();
  assert.equal(app.requests[0].args[4].aborted, true);
  app.requests[1].resolve({ data: app.data }); await app.tick();
  app.requests[0].resolve({ error: true, message: 'stale failure' }); await app.tick();
  assert.equal(app.nodes().some(n => app.text(n).includes('stale failure')), false);
});

test('status multiselect sends explicit selections and All, resetting shipment pagination', async () => {
  const app = harness(); await app.load();
  const choice = label => app.find(n => n.type === 'DropdownMenuCheckboxItem' && app.text(n) === label);
  assert.equal(choice('Delivered').props.checked, false);
  choice('Delivered').props.onCheckedChange(true); app.render(); app.timersRun();
  assert.ok(app.requests.at(-1).args[2].shipment_statuses.split(',').includes('delivered'));
  assert.equal(app.requests.at(-1).args[2].shipment_page, 1);
  choice('All').props.onCheckedChange(true); app.render(); app.timersRun();
  assert.equal(app.requests.at(-1).args[2].shipment_statuses, 'all');
  choice('Delivered').props.onCheckedChange(false); app.render(); app.timersRun();
  assert.ok(!app.requests.at(-1).args[2].shipment_statuses.split(',').includes('delivered'));
  choice('All').props.onCheckedChange(false); app.render(); app.timersRun();
  assert.equal(app.requests.at(-1).args[2].shipment_statuses, 'none');
  choice('Delivered').props.onCheckedChange(true); app.render(); app.timersRun();
  assert.equal(app.requests.at(-1).args[2].shipment_statuses, 'delivered');
});
test('delivered shipments remain visible but cannot be assigned or dragged', async () => {
  const app = harness(); app.data.shipments[0].status = 'delivered'; await app.load();
  const card = app.find(n => n.props?.draggable !== undefined && app.text(n).includes('DN-1'));
  assert.equal(card.props.draggable, false);
  assert.equal(app.nodes(card).some(n => n.type === 'Button' && app.text(n) === 'Assign to run'), false);
});

test('collapsed search retains its query, supports Escape and keeps server filtering', async () => {
  const app = harness(); await app.load();
  assert.equal(app.find(n => n.props?.['aria-label'] === 'Search drivers'), undefined);
  app.find(n => n.props?.['aria-label'] === 'Toggle search drivers').props.onClick(); app.render();
  app.find(n => n.props?.['aria-label'] === 'Search drivers').props.onChange({ target: { value: 'Alex' } }); app.render(); app.timersRun();
  assert.equal(app.requests.at(-1).args[2].driver_search, 'Alex');
  app.find(n => n.props?.['aria-label'] === 'Search drivers').props.onKeyDown({ key: 'Escape', preventDefault() {} }); app.render();
  assert.equal(app.find(n => n.props?.['aria-label'] === 'Search drivers'), undefined);
  app.find(n => n.props?.['aria-label'] === 'Toggle search drivers').props.onClick(); app.render();
  assert.equal(app.find(n => n.props?.['aria-label'] === 'Search drivers').props.value, 'Alex');
});
test('compact driver row exposes complete assignments and opens the existing run picker', async () => {
  const app = harness(); app.data.drivers[0].assigned = true;
  app.data.drivers[0].assigned_runs = [{ run_id: 'outside-truck-page', status: 'draft' }, { run_id: 'active', status: 'in_progress' }];
  await app.load();
  const row = app.find(n => n.props?.['data-schedule-driver-row']);
  assert.ok(app.text(row).includes('Run outside- · Planned'));
  assert.ok(app.text(row).includes('Run active · Active'));
  row.props.onClick(); app.render();
  assert.ok(app.find(n => n.type === 'Drawer' && n.props.open && app.text(n).includes('Choose a run')));
  assert.equal(app.writes.length, 0);
});
test('active run Options and inline tiles cannot reassign drivers or existing shipments', async () => {
  const app = harness(); await app.load();
  const article = app.find(n => n.type === 'article' && n.props['aria-label'] === 'Run active');
  const nodes = app.nodes(article);
  assert.ok(nodes.some(n => n.props?.href === 'active' && app.text(n) === 'View run'));
  assert.equal(nodes.some(n => n.type === 'DropdownMenuItem' && ['Assign driver', 'Edit plan', 'Remove driver', 'Replace driver'].includes(app.text(n))), false);
  const tile = nodes.find(n => n.props?.['data-schedule-shipment-tile']);
  assert.equal(tile.props.draggable, false);
  assert.equal(app.nodes(tile).some(n => n.type === 'DropdownMenuItem'), false);
  const creation = nodes.find(n => n.type === 'ShipmentQuoteDialog');
  assert.equal(creation.props.trigger.props['aria-label'], 'Add shipment to run active');
  assert.equal(creation.props.trigger.props.disabled, false);
  assert.equal(utils.eligibleRun({ kind: 'shipment', shipment: { ...shipment, status: 'delivered' } }, active), false);
});
test('planned-run Options open a driver chooser and cancelled replacement writes nothing', async () => {
  const app = harness(); app.data.trucks[0].runs[1].driver = { driver_id: 'other', name: 'Other driver' }; await app.load();
  const article = app.find(n => n.type === 'article' && n.props['aria-label'] === 'Run planned');
  app.nodes(article).find(n => n.type === 'DropdownMenuItem' && app.text(n) === 'Replace driver').props.onSelect(); app.render();
  const chooser = app.find(n => n.type === 'Drawer' && n.props.open && app.text(n).includes('Choose a driver'));
  app.nodes(chooser).find(n => n.type === 'Button' && app.text(n).includes('Alex')).props.onClick(); await app.tick();
  assert.equal(app.writes.length, 0);
  assert.ok(app.find(n => n.type === 'Drawer' && n.props.open && app.text(n).includes('Choose a driver')));
});
test('read-only board retains details but hides mutations and terminal shipment actions', async () => {
  const app = harness(); app.data.can_manage = false;
  app.data.trucks.forEach(t => { t.can_create = false; t.runs.forEach(r => { r.can_assign_driver = false; r.can_add_shipment = false; }); });
  await app.load();
  assert.equal(app.nodes().some(n => n.type === 'DropdownMenuItem' && ['Assign driver', 'Edit plan', 'Remove driver', 'Replace driver'].includes(app.text(n))), false);
  assert.equal(app.nodes().some(n => n.type === 'ShipmentQuoteDialog' && n.props.trigger.props['aria-label']?.startsWith('Add shipment')), false);
  const row = app.find(n => n.props?.['data-schedule-driver-row']); row.props.onClick(); app.render();
  assert.equal(app.nodes().some(n => n.type === 'Drawer' && n.props.open), false);
  assert.equal(app.writes.length, 0);
});
test('driver filter preserves the server-selected value and resets pagination', async () => {
  const app = harness(); await app.load();
  app.find(n => n.type === 'DropdownMenuRadioGroup').props.onValueChange('assigned'); app.render(); app.timersRun();
  assert.equal(app.requests.at(-1).args[2].driver_filter, 'assigned');
  assert.equal(app.requests.at(-1).args[2].driver_page, 1);
});
