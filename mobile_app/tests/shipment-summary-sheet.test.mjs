import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { summaryShipments } from '../src/components/dashboard/shipment-summary.ts';

const shipments = ['booked', 'in_transit', 'delivered', 'failed', 'cancelled', 'returned'].map((status, i) => ({ shipment_id: String(i), status, merchant_order_ref: `Order ${i}`, dropoff_location: { name: `Destination ${i}` } }));

test('summary lists preserve count status rules and server shipment order', () => {
  assert.deepEqual(summaryShipments(shipments, 'Shipments'), shipments);
  assert.deepEqual(summaryShipments(shipments, 'Remaining').map(s => s.shipment_id), ['0', '1', '5']);
  assert.deepEqual(summaryShipments(shipments, 'Delivered').map(s => s.shipment_id), ['2']);
  assert.deepEqual(summaryShipments([], 'Remaining'), []);
});

function harness(filter, rows = shipments) {
  const refs = [], effects = [], opened = [];
  let tree, dismissed = 0, dismissRequested = 0, presented = 0;
  const modules = {
    react: { useRef: initial => { const ref = { current: initial }; refs.push(ref); return ref; }, useEffect: fn => effects.push(fn) },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { create: x => x } },
    '@expo/vector-icons': { Feather: 'Feather' }, '@gorhom/bottom-sheet': {},
    '@/component/ui/BottomSheet': { BottomSheet: 'BottomSheet' }, '@/component/ui/Text': { Text: 'Text' },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'dark' }) },
    './shipment-summary': { summaryShipments },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/dashboard/ShipmentSummarySheet.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => modules[name] });
  tree = exports.ShipmentSummarySheet({ filter, shipments: rows, onDismiss: () => dismissed++, onOpenShipment: id => opened.push(id) });
  tree.props.modalRef.current = { present: () => presented++, dismiss: () => dismissRequested++ };
  const cleanups = effects.map(fn => fn());
  function nodes(type) { const found = []; function visit(n) { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(visit); if (n.type === type) found.push(n); visit(n.props?.children); } visit(tree); return found; }
  return { tree, opened, nodes, requested: () => dismissRequested, presented: () => presented, dismissed: () => dismissed, unmount: () => cleanups.forEach(fn => fn?.()) };
}

test('list rows show actual references/destinations and open details only after dismissal', () => {
  const h = harness('Delivered');
  assert.equal(h.presented(), 1); assert.equal(h.nodes('Pressable').length, 1);
  assert.ok(h.nodes('Text').some(n => n.props.children === 'Order 2'));
  assert.ok(h.nodes('Text').some(n => n.props.children === 'Destination 2'));
  h.nodes('Pressable')[0].props.onPress(); h.nodes('Pressable')[0].props.onPress();
  assert.equal(h.requested(), 1); assert.deepEqual(h.opened, []);
  h.tree.props.onDismiss(); assert.deepEqual(h.opened, ['2']); assert.equal(h.dismissed(), 1);
});

test('zero totals show an empty sheet; closing or unmounting never opens a shipment', () => {
  const empty = harness('Remaining', []); assert.equal(empty.nodes('Pressable').length, 0);
  assert.ok(empty.nodes('Text').some(n => n.props.children === 'No remaining shipments in this run.'));
  empty.tree.props.onDismiss(); assert.deepEqual(empty.opened, []);
  const pending = harness('Shipments'); pending.nodes('Pressable')[0].props.onPress(); pending.unmount(); pending.tree.props.onDismiss();
  assert.deepEqual(pending.opened, []);
});
