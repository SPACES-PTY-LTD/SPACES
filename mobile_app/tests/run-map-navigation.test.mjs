import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { groupRunMapStops, locationCoordinate, runMapStops } from '../src/components/dashboard/run-map-data.ts';

function harness() {
  const slots = [], effects = [], requests = [], timers = new Map(), listeners = new Set();
  let cursor = 0, tree, focused = true, stopped = 0;
  const same = (a, b) => a && b.length === a.length && b.every((v, i) => Object.is(v, a[i]));
  const react = {
    useState(initial) { const i = cursor++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, v => { slots[i].value = typeof v === 'function' ? v(slots[i].value) : v; }]; },
    useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
    useMemo(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useCallback(fn, deps) { return this.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) { slots[i]?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); }); } },
  };
  // Imported hooks are called without their object as receiver.
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps);
  const native = { View: 'View', Pressable: 'Pressable', StyleSheet: { create: x => x }, AppState: { currentState: 'active', addEventListener: (_, fn) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } } };
  const modules = {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }, 'react-native': native,
    'expo-router/react-navigation': { useIsFocused: () => focused }, '@expo/vector-icons': { Feather: 'Feather' },
    'react-native-maps': { default: 'MapView', Marker: 'Marker', Callout: 'Callout', Polyline: 'Polyline' },
    '@/component/ui/ActionSheet': { ActionSheet: 'ActionSheet' }, '@/component/ui/Text': { Text: 'Text' },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'light' }) },
    '@/src/lib/api': { driverApi: {
      runPosition: async () => ({ coordinate: { latitude: -26, longitude: 28 } }),
      runNavigation: (token, run, shipment) => new Promise((resolve, reject) => requests.push({ token, run, shipment, resolve, reject })),
      runDirections: (token, run) => new Promise((resolve, reject) => requests.push({ token, run, resolve, reject })),
    } },
    './useRecordedRunTrack': { useRecordedRunTrack: () => ({}) }, './NativeMap': { NativeMap: 'NativeMap' },
    './truck-position-label': { truckPositionDescription: () => 'Last report' }, './run-map-data': { groupRunMapStops, locationCoordinate, runMapStops },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/dashboard/RunMap.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require: name => modules[name], __DEV__: false, Date, JSON,
    setInterval: (fn, ms) => { const key = {}; timers.set(key, { fn, ms }); return key; }, clearInterval: key => timers.delete(key),
  });
  const shipment = id => ({ shipment_id: id, status: 'booked', dropoff_location: { name: id, latitude: -26.1, longitude: 28.1 } });
  const props = { runId: 'run', token: 'token', topInset: 44, shipments: [shipment('first'), shipment('selected')], endpoints: [{ role: 'Planned end location', latitude: -27, longitude: 29 }], onOpenShipment() {}, onStopNavigation: () => stopped++ };
  props.navigationShipment = props.shipments[1];
  function render() { cursor = 0; tree = exports.RunMap(props); while (effects.length) effects.shift()(); return tree; }
  function nodes(type) { const result = []; const visit = n => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(visit); if (n.type === type) result.push(n); visit(n.props?.children); }; visit(tree); return result; }
  return { props, requests, render, nodes, stopped: () => stopped, async flush() { for (let i = 0; i < 15; i++) await Promise.resolve(); render(); }, tick() { for (const t of timers.values()) if (t.ms === 60000) t.fn(); }, state(value) { native.AppState.currentState = value; for (const fn of listeners) fn(value); }, focus(value) { focused = value; render(); } };
}
const route = { status: 'ready', shipment_id: 'selected', coordinates: [{ latitude: -26, longitude: 28 }, { latitude: -26.1, longitude: 28.1 }], distance_meters: 1000, duration_seconds: 120 };

test('selected route hides unrelated pins, refreshes only while active, and Stop remains usable on failure', async () => {
  const h = harness(); h.render(); await h.flush();
  assert.equal(h.requests[0].shipment, 'selected');
  h.requests[0].resolve(route); await h.flush();
  assert.equal(h.nodes('Polyline').length, 1);
  assert.deepEqual(h.nodes('Marker').map(n => n.props.title), ['Your truck', 'Stop 2']);
  h.state('background'); h.tick(); assert.equal(h.requests.length, 1);
  h.state('active'); assert.equal(h.requests.length, 2);
  h.requests[1].reject(new Error('Offline')); await h.flush();
  assert.equal(h.nodes('Polyline').length, 0);
  assert.ok(h.nodes('Text').some(n => n.props.children === 'Road directions unavailable.'));
  h.nodes('Pressable').find(n => n.props.accessibilityLabel === 'Stop navigation').props.onPress(); assert.equal(h.stopped(), 1);
  h.nodes('Pressable').find(n => n.props.children?.props?.children === 'Retry route').props.onPress(); h.render();
  assert.equal(h.requests.length, 3);
  h.focus(false); h.tick(); assert.equal(h.requests.length, 3);
});

test('late selected-route responses cannot replace the overview; mismatched shipments never draw a route', async () => {
  const h = harness(); h.render();
  h.requests[0].resolve({ ...route, shipment_id: 'wrong' }); await h.flush();
  assert.equal(h.nodes('Polyline').length, 0);
  h.tick(); assert.equal(h.requests.length, 2);
  h.props.navigationShipment = undefined; h.render();
  assert.equal(h.requests[2].shipment, undefined);
  h.requests[1].resolve(route); await h.flush();
  assert.equal(h.nodes('Polyline').length, 0);
  assert.equal(h.nodes('NativeMap')[0].props.accessibilityLabel, 'Current run shipment locations');
});
