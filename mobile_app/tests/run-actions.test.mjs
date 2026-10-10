import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness() {
  let cursor = 0, tree, config, saves = 0; const slots = [], effects = [], routes = [];
  const modules = {
    react: {
      useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = value; }]; },
      useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
      useEffect(fn) { const i = cursor++; if (!slots[i]) { slots[i] = {}; effects.push(() => { slots[i].cleanup = fn(); }); } },
    },
    'react/jsx-runtime': { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { Pressable: 'Pressable', StyleSheet: { create: styles => styles } },
    'expo-router': { useRouter: () => ({ push: route => routes.push(route) }) }, 'expo-crypto': { randomUUID: () => 'request' },
    '@/component/ui/ActionSheet': { ActionSheet: 'ActionSheet' }, '@/component/ui/Text': { Text: 'Text' },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'light' }) },
    '../dashboard/RunActionForm': { RunActionForm: 'RunActionForm' }, '../dashboard/DeliveryOrderSheet': { DeliveryOrderSheet: 'DeliveryOrderSheet' },
  };
  const exports = {}; const source = readFileSync(new URL('../src/components/runs/RunActions.tsx', import.meta.url), 'utf8').replace('function ActiveRunActions(', 'export function ActiveRunActions(');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; } });
  const props = { token: 'token', ownerId: 'driver', run: { run_id: 'run', status: 'in_progress', has_delivery_note: false }, reference: 'Run 123', onSaved: () => saves++ };
  function nodes(type) { const result = []; function visit(n) { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(visit); if (n.type === type) result.push(n); visit(n.props?.children); } visit(tree); return result; }
  return { props, routes, exports, nodes, get saves() { return saves; }, render(patch = {}) { cursor = 0; tree = exports.ActiveRunActions({ ...props, ...patch }); nodes('ActionSheet')[0].props.ref.current = { present: value => { config = value; } }; while (effects.length) effects.shift()(); }, open() { nodes('Pressable')[0].props.onPress(); return config; }, unmount() { slots.forEach(slot => slot.cleanup?.()); } };
}
test('shared active actions include expected options and reuse forms/order workflow with refresh', () => {
  const app = harness(); app.render(); const menu = app.open();
  assert.deepEqual(Array.from(menu.actions, a => a.id), ['edit', 'order', 'cost', 'upload-delivery-note', 'message-dispatch', 'end']);
  for (const action of ['edit', 'cost', 'end', 'order']) { menu.actions.find(a => a.id === action).onPress(); app.render(); const form = app.nodes(action === 'order' ? 'DeliveryOrderSheet' : 'RunActionForm')[0]; assert.equal(form.props.token, 'token'); assert.equal(action === 'order' ? form.props.runId : form.props.run.run_id, 'run'); form.props.onSaved(); app.render(); assert.equal(app.nodes('RunActionForm').length, 0); }
  assert.equal(app.saves, 4);
});
test('shared menu gates note upload/pending end, preserves navigation owner and targets viewed run', () => {
  const app = harness(); app.render(); let menu = app.open();
  menu.actions.find(a => a.id === 'upload-delivery-note').onPress(); assert.equal(app.routes[0].params.run_id, 'run');
  menu.actions.find(a => a.id === 'message-dispatch').onPress(); assert.equal(app.routes[1].params.draft_owner, 'driver'); assert.equal(app.routes[1].params.draft_run_label, 'Run 123'); assert.equal(app.routes[1].params.draft_run_id, 'run');
  app.render({ run: { ...app.props.run, has_delivery_note: true, end_request: { status: 'pending' } } }); menu = app.open(); assert.equal(menu.actions.some(a => a.id === 'upload-delivery-note'), false); assert.equal(menu.actions.find(a => a.id === 'end').disabled, true); menu.actions.find(a => a.id === 'end').onPress(); app.render(); assert.equal(app.nodes('RunActionForm').length, 0);
});
test('inactive runs have no Actions and disabled or unmounted triggers cannot act', () => {
  const app = harness(); for (const status of ['completed', 'draft', 'dispatched']) assert.equal(app.exports.RunActions({ ...app.props, run: { ...app.props.run, status } }), null);
  app.render({ disabled: true }); assert.equal(app.nodes('Pressable')[0].props.disabled, true); assert.equal(app.open(), undefined);
  app.render(); const menu = app.open(); app.unmount(); menu.actions.find(a => a.id === 'message-dispatch').onPress(); menu.actions.find(a => a.id === 'cost').onPress(); app.render(); assert.equal(app.routes.length, 0); assert.equal(app.nodes('RunActionForm').length, 0);
});
