import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

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
    function visit(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit); if (node.type === type) result.push(node); visit(node.props?.children); }
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
    resolve(index = requests.length - 1) {
      const data = screen === 'runs' ? { data: [{ run_id: 'run', reference: 'Run 1', status: 'in_progress' }], meta: { current_page: 1, last_page: 1 } }
        : { current_run: { run_id: 'run', status: 'in_progress' }, documents: { missing_required_count: 0, expired_count: 0 }, recorded_stops: [], run_shipments: [] };
      requests[index].resolve(data);
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
