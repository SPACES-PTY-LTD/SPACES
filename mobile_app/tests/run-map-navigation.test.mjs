import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { groupRunMapStops, locationCoordinate, runMapStops } from '../src/components/dashboard/run-map-data.ts';

function harness() {
  const slots = [], effects = [], requests = [], timers = new Map(), listeners = new Set();
  let cursor = 0, tree, focused = true, stopped = 0;
  const opened = [], choices = [];
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
  const locator = { currentNavigationLocation: async isCurrent => { if (!isCurrent()) throw new Error('Navigation cancelled.'); return { latitude: 0, longitude: 0, reportedAt: new Date().toISOString() }; } };
  const modules = {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }, 'react-native': native,
    'expo-router/react-navigation': { useIsFocused: () => focused }, '@expo/vector-icons': { Feather: 'Feather' },
    'react-native-maps': { default: 'MapView', Marker: 'Marker', Callout: 'Callout', Polyline: 'Polyline' },
    '@/component/ui/ActionSheet': { ActionSheet: 'ActionSheet' }, '@/component/ui/Text': { Text: 'Text' },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'light' }) },
    '@/src/lib/api': { driverApi: {
      runPosition: async () => ({ coordinate: { latitude: -26, longitude: 28 } }),
      runNavigation: (token, run, shipment, origin) => new Promise((resolve, reject) => requests.push({ token, run, shipment, origin, resolve, reject })),
      runDirections: (token, run) => new Promise((resolve, reject) => requests.push({ token, run, resolve, reject })),
    } },
    './useRecordedRunTrack': { useRecordedRunTrack: () => ({}) }, './NativeMap': { NativeMap: 'NativeMap' },
    './navigation-location': locator,
    './truck-position-label': { truckPositionDescription: () => 'Last report' }, './run-map-data': { groupRunMapStops, locationCoordinate, runMapStops },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/dashboard/RunMap.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require: name => modules[name], __DEV__: false, Date, JSON,
    setInterval: (fn, ms) => { const key = {}; timers.set(key, { fn, ms }); return key; }, clearInterval: key => timers.delete(key),
  });
  const shipment = id => ({ shipment_id: id, status: 'booked', dropoff_location: { name: id, latitude: -26.1, longitude: 28.1 } });
  const props = { runId: 'run', token: 'token', topInset: 44, shipments: [shipment('first'), shipment('selected')], endpoints: [{ role: 'Planned end location', latitude: -27, longitude: 29 }], onOpenShipment(id) { opened.push(id); }, onStopNavigation: () => stopped++ };
  props.navigationShipment = props.shipments[1];
  function render() { cursor = 0; tree = exports.RunMap(props); while (effects.length) effects.shift()(); return tree; }
  function nodes(type) { const result = []; const visit = n => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(visit); if (n.type === type) result.push(n); visit(n.props?.children); }; visit(tree); return result; }
  return { props, requests, render, nodes, locator, opened, choices, stopped: () => stopped, async flush() { for (let i = 0; i < 15; i++) await Promise.resolve(); render(); }, tick() { for (const t of timers.values()) if (t.ms === 60000) t.fn(); }, state(value) { native.AppState.currentState = value; for (const fn of listeners) fn(value); }, focus(value) { focused = value; render(); } };
}
const route = { status: 'ready', shipment_id: 'selected', origin_source: 'phone', origin_coordinate: { latitude: 0, longitude: 0 }, coordinates: [{ latitude: -26, longitude: 28 }, { latitude: -26.1, longitude: 28.1 }], distance_meters: 1000, duration_seconds: 120 };

test('selected route hides unrelated pins, refreshes only while active, and Stop remains usable on failure', async () => {
  const h = harness(); h.render(); await h.flush();
  assert.equal(h.requests[0].shipment, 'selected');
  assert.equal(h.requests[0].origin.latitude, 0);
  assert.equal(h.requests[0].origin.longitude, 0);
  h.requests[0].resolve(route); await h.flush();
  assert.equal(h.nodes('Polyline').length, 1);
  assert.deepEqual(h.nodes('Marker').map(n => n.props.title), ['Your phone location', undefined]);
  h.state('background'); h.tick(); assert.equal(h.requests.length, 1);
  h.state('active'); await h.flush(); assert.equal(h.requests.length, 2);
  h.requests[1].reject(new Error('Offline')); await h.flush();
  assert.equal(h.nodes('Polyline').length, 0);
  assert.ok(h.nodes('Text').some(n => typeof n.props.children === 'string' && /unavailable|Offline/.test(n.props.children)));
  h.nodes('Pressable').find(n => n.props.accessibilityLabel === 'Stop navigation').props.onPress(); assert.equal(h.stopped(), 1);
  h.nodes('Pressable').find(n => n.props.children?.props?.children === 'Retry route').props.onPress(); h.render(); await h.flush();
  assert.equal(h.requests.length, 3);
  h.focus(false); h.tick(); assert.equal(h.requests.length, 3);
});

test('late selected-route responses cannot replace the overview; mismatched shipments never draw a route', async () => {
  const h = harness(); h.render(); await h.flush();
  h.requests[0].resolve({ ...route, shipment_id: 'wrong' }); await h.flush();
  assert.equal(h.nodes('Polyline').length, 0);
  h.tick(); await h.flush(); assert.equal(h.requests.length, 2);
  h.props.navigationShipment = undefined; h.render();
  assert.equal(h.requests[2].shipment, undefined);
  h.requests[1].resolve(route); await h.flush();
  assert.equal(h.nodes('Polyline').length, 0);
  assert.equal(h.nodes('NativeMap')[0].props.accessibilityLabel, 'Current run shipment locations');
});

test('a legacy truck-origin response cannot be used for phone navigation', async () => {
  const h = harness(); h.render(); await h.flush();
  h.requests[0].resolve({ ...route, origin_source: 'truck' }); await h.flush();
  assert.equal(h.nodes('Polyline').length, 0);
  assert.equal(h.nodes('Marker').some(n => n.props.title === 'Your truck'), false);
});

test('stopping while GPS is pending never starts a selected-route request', async () => {
  const h = harness(); let resolve;
  h.locator.currentNavigationLocation = () => new Promise(done => { resolve = done; });
  h.render(); h.props.navigationShipment = undefined; h.render();
  resolve({ latitude: 0, longitude: 0, reportedAt: new Date().toISOString() }); await h.flush();
  assert.equal(h.requests.some(r => r.shipment), false);
});

test('shipment marker shows a location popup before Shipment info opens details', async () => {
  const h = harness(); h.render(); await h.flush();
  const map = h.nodes('NativeMap')[0];
  map.props.ref.current = { pointForCoordinate: async () => ({ x: 180, y: 300 }) };
  map.props.onLayout({ nativeEvent: { layout: { width: 390, height: 600 } } }); h.render();
  const marker = h.nodes('Marker').find(n => n.props.identifier === 'stop-2');
  let propagated = false;
  marker.props.onPress({ stopPropagation() { propagated = true; } }); await h.flush();
  assert.equal(propagated, true); assert.deepEqual(h.opened, []);
  assert.ok(h.nodes('Text').some(n => n.props.children === 'Stop 2'));
  assert.ok(h.nodes('Text').some(n => n.props.children === 'selected'));
  const pointer = h.nodes('View').find(n => n.props.testID === 'shipment-popup-pointer');
  assert.equal(pointer.props.pointerEvents, 'none');
  assert.equal(pointer.props.style[1].borderBottomWidth, 20);
  h.nodes('Pressable').find(n => n.props.accessibilityLabel === 'Shipment info').props.onPress(); h.render();
  assert.deepEqual(h.opened, ['selected']);
  assert.equal(h.nodes('Pressable').some(n => n.props.accessibilityLabel === 'Shipment info'), false);
});

test('map dismissal and changed navigation ignore late popup projection', async () => {
  const h = harness(); h.render(); await h.flush();
  const map = h.nodes('NativeMap')[0]; let resolve;
  map.props.ref.current = { pointForCoordinate: () => new Promise(done => { resolve = done; }) };
  map.props.onLayout({ nativeEvent: { layout: { width: 390, height: 600 } } }); h.render();
  h.nodes('Marker').find(n => n.props.identifier === 'stop-2').props.onPress({});
  h.nodes('NativeMap')[0].props.onPress({ nativeEvent: {} });
  resolve({ x: 180, y: 300 }); await h.flush();
  assert.equal(h.nodes('Pressable').some(n => n.props.accessibilityLabel === 'Shipment info'), false);
  h.nodes('Marker').find(n => n.props.identifier === 'stop-2').props.onPress({});
  h.props.navigationShipment = undefined; h.render(); resolve({ x: 180, y: 300 }); await h.flush();
  assert.equal(h.nodes('Pressable').some(n => n.props.accessibilityLabel === 'Shipment info'), false);
});

test('shared marker Shipment info offers all co-located shipments without opening one immediately', async () => {
  const h = harness(); h.props.navigationShipment = undefined; h.render(); await h.flush();
  const map = h.nodes('NativeMap')[0];
  map.props.ref.current = { pointForCoordinate: async () => ({ x: 180, y: 300 }) };
  h.nodes('ActionSheet')[0].props.ref.current = { present: value => h.choices.push(value) };
  map.props.onLayout({ nativeEvent: { layout: { width: 390, height: 600 } } }); h.render();
  h.nodes('Marker').find(n => n.props.identifier === 'stop-1 · 2').props.onPress({}); await h.flush();
  assert.equal(h.choices.length, 0); assert.deepEqual(h.opened, []);
  assert.ok(h.nodes('Text').some(n => n.props.children === 'Stops 1 · 2'));
  h.nodes('Pressable').find(n => n.props.accessibilityLabel === 'Shipment info').props.onPress(); h.render();
  assert.deepEqual(h.opened, []); assert.equal(h.choices.length, 1);
  assert.deepEqual(h.choices[0].actions.map(a => a.id), ['first', 'selected']);
  h.choices[0].actions[1].onPress(); assert.deepEqual(h.opened, ['selected']);
});


test('popup pointer stays on the projected marker when the card is shifted at map edges', async () => {
  for (const point of [{ x: 20, y: 480 }, { x: 370, y: 480 }, { x: 20, y: 280 }]) {
    const h = harness(); h.props.navigationShipment = undefined; h.render(); await h.flush();
    const map = h.nodes('NativeMap')[0];
    map.props.ref.current = { pointForCoordinate: async () => point };
    map.props.onLayout({ nativeEvent: { layout: { width: 390, height: 600 } } }); h.render();
    h.nodes('Marker').find(n => n.props.identifier === 'stop-1 · 2').props.onPress({}); await h.flush();
    const card = h.nodes('View').find(n => n.props.onLayout && n.props.style?.[0]?.padding === 12);
    card.props.onLayout({ nativeEvent: { layout: { height: 140 } } }); h.render();
    const current = h.nodes('View').find(n => n.props.onLayout && n.props.style?.[0]?.padding === 12).props.style[1];
    const pointer = h.nodes('View').find(n => n.props.testID === 'shipment-popup-pointer').props.style[1];
    const height = pointer.borderTopWidth || pointer.borderBottomWidth;
    const skew = Math.tan(parseFloat(pointer.transform[0].skewX) * Math.PI / 180);
    const downward = pointer.borderTopWidth > 0;
    const tipX = current.left + pointer.left + 10 + skew * (downward ? height / 2 : -height / 2);
    const tipY = current.top + pointer.top + (downward ? height : 0);
    assert.ok(Math.abs(tipX - point.x) < 0.001);
    assert.equal(tipY, point.y - (downward ? 30 : 0));
    assert.equal(pointer.borderTopColor, '#ffffff');
  }
});
