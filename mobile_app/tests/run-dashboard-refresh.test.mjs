import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { shipmentSummaryFilters, summaryShipments } from '../src/components/dashboard/shipment-summary.ts';

function harness(screen) {
  const slots = [], effects = [], requests = [];
  let cursor = 0, tree, focused = true, foreground;
  const session = { token: 'token', user: { user_id: 'driver' } };
  const updateCount = () => {};
  const request = () => new Promise((resolve, reject) => requests.push({ resolve, reject }));
  function effect(callback, deps) {
    const i = cursor++;
    if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) {
      slots[i]?.cleanup?.(); slots[i] = { deps };
      effects.push(() => { slots[i].cleanup = callback(); });
    }
  }
  const react = {
    useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
    useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
    useCallback(callback, deps) { const i = cursor++; if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) slots[i] = { callback, deps }; return slots[i].callback; },
    useEffect: effect,
  };
  const native = Object.fromEntries(['View', 'Pressable', 'FlatList', 'ScrollView', 'RefreshControl', 'ActivityIndicator'].map(name => [name, name]));
  Object.assign(native, { StyleSheet: { create: styles => styles }, useWindowDimensions: () => ({ height: 900 }), AppState: { addEventListener: (_, fn) => { foreground = fn; return { remove() {} }; } } });
  const modules = {
    '@/src/navigation/GuidanceProvider': { useGuidance: () => ({ state: { phase: 'idle', muted: false }, available: true, start: async () => {}, exit: async () => {} }) },
    '@/src/navigation/GuidanceMap': { GuidanceMap: 'GuidanceMap' },
    react,
    'react/jsx-runtime': { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) },
    'react-native': native,
    'expo-router': { useFocusEffect: fn => effect(() => focused ? fn() : undefined, [fn, focused]), useRouter: () => ({ push() {} }), useLocalSearchParams: () => ({}) },
    'expo-router/js-tabs': { useBottomTabBarHeight: () => 80 },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 40 }) },
    'react-native-reanimated': { default: { View: 'AnimatedView' }, useSharedValue: value => ({ value }), useAnimatedStyle: fn => fn() },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView' },
    '@/src/providers/auth-provider': { useAuth: () => ({ session }) },
    '@/src/providers/required-documents-provider': { useRequiredDocuments: () => ({ updateCount }) },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'dark' }) },
    '@/src/lib/api': { driverApi: { listRuns: request, dashboard: request, listOffers: async () => [] }, documentImportApi: {} },
    '@/component/ui/Text': { Text: 'Text' },
    '@/component/ui/PageHeader': { PageHeader: 'PageHeader' },
    '@/src/components/runs/RunSummaryCard': { RunSummaryCard: 'RunSummaryCard', runStatusLabel: status => status },
    '@/src/components/dashboard/run-stop-filter': { filterRunStops: stops => stops },
    '@expo/vector-icons': { Feather: 'Feather' },
    '@gorhom/bottom-sheet': {},
    'expo-crypto': { randomUUID: () => 'request' },
    '@/src/components/dashboard/NextDeliveryCard': { NextDeliveryCard: 'NextDeliveryCard', nextDelivery: shipments => shipments.find(s => !['delivered', 'failed', 'cancelled', 'returned'].includes(s.status)) },
    '@/src/components/dashboard/shipment-summary': { shipmentSummaryFilters, summaryShipments },
    '@/src/components/dashboard/ShipmentSummarySheet': { ShipmentSummarySheet: 'ShipmentSummarySheet' },
    '@/src/components/dashboard/ActiveRunDock': { ActiveRunDock: 'ActiveRunDock' },
  };
  for (const name of ['ShipmentDetails', 'StopDetailsSheet', 'RunTimeline', 'DeliveryOrderSheet', 'RunActionForm', 'FinalDestinationSheet', 'RunMap']) {
    const prefix = name === 'ShipmentDetails' ? '@/src/components/shipments/' : '@/src/components/dashboard/';
    modules[prefix + name] = { [name === 'ShipmentDetails' ? 'ShipmentDetailsSheet' : name]: name };
  }
  for (const name of ['MessageSheet', 'ActionSheet', 'PersistentBottomSheet']) modules['@/component/ui/' + name] = { [name]: name };
  const source = ts.transpileModule(readFileSync(new URL(`../app/(tabs)/${screen}.tsx`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: false },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; }, Date, Map, Error });
  function nodes(type) {
    const result = [];
    function visit(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit); if (node.type === type) result.push(node); visit(node.props?.children); visit(typeof node.props?.header === 'function' ? node.props.header(() => {}) : node.props?.header); }
    visit(tree); return result;
  }
  function render() {
    cursor = 0; tree = exports.default();
    if (screen === 'runs') {
      const list = tree.props.children.find(child => typeof child?.type === 'function');
      tree = list.type(list.props);
    }
    while (effects.length) effects.shift()();
  }
  return {
    requests, render, nodes,
    control() { return screen === 'runs' ? nodes('FlatList')[0].props : nodes('ScrollView')[0].props.refreshControl.props; },
    resolve(index = requests.length - 1, patch = {}) {
      const data = screen === 'runs' ? { data: [{ run_id: 'run', reference: 'Run 1', status: 'in_progress' }], meta: { current_page: 1, last_page: 1 } }
        : { current_run: { run_id: 'run', status: 'in_progress' }, documents: { missing_required_count: 0, expired_count: 0 }, recorded_stops: [], run_shipments: [] };
      requests[index].resolve({ ...data, ...patch });
    },
    async flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); render(); },
    foreground() { foreground('active'); render(); },
    focus(value) { focused = value; render(); render(); },
    pull() { this.control().onRefresh(); render(); },
  };
}

for (const screen of ['runs', 'index']) {
  test(`${screen}: initial and automatic loads never open native pull-refresh space`, async () => {
    const app = harness(screen); app.render();
    assert.equal(app.control().refreshing, false);
    app.resolve(); await app.flush();
    app.foreground(); assert.equal(app.control().refreshing, false);
    app.resolve(); await app.flush();
    app.focus(false); app.focus(true); assert.equal(app.control().refreshing, false);
    app.resolve(); await app.flush();
    const scroll = app.nodes(screen === 'runs' ? 'FlatList' : 'ScrollView')[0].props;
    assert.equal(scroll.contentInsetAdjustmentBehavior, 'never');
    assert.equal(scroll.automaticallyAdjustContentInsets, false);
  });
  test(`${screen}: pull feedback ends on success, failure and leaving the screen`, async () => {
    const app = harness(screen); app.render(); app.resolve(); await app.flush();
    app.pull(); assert.equal(app.control().refreshing, true);
    app.resolve(); await app.flush(); assert.equal(app.control().refreshing, false);
    app.pull(); app.requests.at(-1).reject(new Error('Offline')); await app.flush();
    assert.equal(app.control().refreshing, false);
    app.pull(); app.focus(false); assert.equal(app.control().refreshing, false);
    app.resolve(); await app.flush(); assert.equal(app.control().refreshing, false);
    app.focus(true); assert.equal(app.control().refreshing, false);
    app.resolve(); await app.flush();
  });
  test(`${screen}: stale request completion does not end a newer pull refresh`, async () => {
    const app = harness(screen); app.render(); app.resolve(); await app.flush();
    app.foreground(); const old = app.requests.length - 1;
    app.pull(); assert.equal(app.control().refreshing, true);
    app.resolve(old); await app.flush(); assert.equal(app.control().refreshing, true);
    app.resolve(); await app.flush(); assert.equal(app.control().refreshing, false);
  });
}


test('dashboard run header appears only for in-progress work and starts compact', async () => {
  const app = harness('index'); app.render();
  assert.equal(app.nodes('ActiveRunDock').length, 0);
  app.resolve(); await app.flush();
  assert.equal(app.nodes('ActiveRunDock').length, 1);
  assert.equal(app.nodes('PersistentBottomSheet')[0].props.initialSnapIndex, 0);
  assert.equal(app.nodes('PersistentBottomSheet')[0].props.collapsedHeight, 126);
  assert.equal(app.nodes('ScrollView')[0].props.contentContainerStyle.paddingBottom, 24);
  for (const status of ['draft', 'dispatched', 'completed', null]) {
    app.foreground();
    app.resolve(undefined, { current_run: status ? { run_id: 'run', status } : null }); await app.flush();
    assert.equal(app.nodes('ActiveRunDock').length, 0);
    assert.equal(app.nodes('PersistentBottomSheet')[0].props.initialSnapIndex, 1);
    assert.equal(app.nodes('PersistentBottomSheet')[0].props.collapsedHeight, undefined);
    assert.equal(app.nodes('ScrollView')[0].props.contentContainerStyle.paddingBottom, 24);
  }
});

test('Navigate selects the displayed delivery, Stop restores overview, and completed or changed runs clear navigation', async () => {
  const app = harness('index'); app.render();
  const shipment = { shipment_id: 'selected', status: 'booked', dropoff_location: { latitude: 0, longitude: 0 } };
  app.resolve(undefined, { run_shipments: [shipment] }); await app.flush();
  app.nodes('NextDeliveryCard')[0].props.onNavigate('selected'); app.render();
  assert.equal(app.nodes('RunMap')[0].props.navigationShipment.shipment_id, 'selected');
  assert.equal(app.nodes('NextDeliveryCard').length, 0);
  app.nodes('RunMap')[0].props.onStopNavigation(); app.render();
  assert.equal(app.nodes('RunMap')[0].props.navigationShipment, undefined);
  assert.equal(app.nodes('NextDeliveryCard').length, 1);
  app.nodes('NextDeliveryCard')[0].props.onNavigate('selected'); app.render();
  app.foreground(); app.resolve(undefined, { run_shipments: [{ ...shipment, status: 'delivered' }] }); await app.flush();
  assert.equal(app.nodes('RunMap')[0].props.navigationShipment, undefined);
  app.foreground(); app.resolve(undefined, { run_shipments: [shipment] }); await app.flush();
  app.nodes('NextDeliveryCard')[0].props.onNavigate('selected'); app.render();
  app.foreground(); app.resolve(undefined, { current_run: { run_id: 'other', status: 'in_progress' }, run_shipments: [shipment] }); await app.flush();
  assert.equal(app.nodes('RunMap')[0].props.navigationShipment, undefined);
  app.foreground(); app.resolve(undefined, { run_shipments: [shipment] }); await app.flush();
  assert.equal(app.nodes('RunMap')[0].props.navigationShipment, undefined);
});

test('dashboard status buttons open matching actual shipment lists and hand off to details', async () => {
  const h = harness('index'); h.render();
  const shipments = [{ shipment_id: 'a', status: 'booked' }, { shipment_id: 'b', status: 'delivered' }, { shipment_id: 'c', status: 'failed' }];
  h.resolve(0, { run_shipments: shipments }); await h.flush();
  for (const [filter, count] of [['Shipments', 3], ['Remaining', 1], ['Delivered', 1]]) {
    h.nodes('Pressable').find(n => n.props.accessibilityLabel === `${count} ${filter.toLowerCase()}. Show shipments`).props.onPress(); h.render();
    const sheet = h.nodes('ShipmentSummarySheet')[0];
    assert.equal(sheet.props.filter, filter); assert.deepEqual(sheet.props.shipments, shipments);
    sheet.props.onDismiss(); sheet.props.onOpenShipment(filter === 'Delivered' ? 'b' : 'a'); h.render();
    assert.equal(h.nodes('ShipmentSummarySheet').length, 0);
    assert.equal(h.nodes('ShipmentDetails').at(-1).props.shipmentId, filter === 'Delivered' ? 'b' : 'a');
  }
});
