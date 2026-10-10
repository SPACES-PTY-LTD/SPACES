import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  const slots = [], effects = [], calls = [];
  let cursor = 0, tree;
  const same = (a, b) => a && a.length === b.length && b.every((v, i) => Object.is(v, a[i]));
  const react = {
    useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = value; }]; },
    useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i]; },
    useCallback(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { deps, value: fn }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) { slots[i]?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); }); } },
  };
  const sdk = { NavigationView: 'NavigationView', CameraPerspective: { TILTED: 1 }, NavigationUIEnabledPreference: { AUTOMATIC: 0 }, NavigationNightMode: { FORCE_DAY: 0, FORCE_NIGHT: 1 } };
  const modules = {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { create: x => x }, Platform: { OS: 'ios' }, PixelRatio: { get: () => 1 } },
    '@expo/vector-icons': { Feather: 'Feather' }, '@/component/ui/Text': { Text: 'Text' },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'light' }) },
    './GuidanceProvider': { useGuidance: () => ({ state: { phase: 'guiding', muted: false } }) }, './navigation-sdk': { navigationSdk: sdk },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/navigation/GuidanceMap.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => modules[name] });
  const controller = { setFollowingPerspective: async () => calls.push('follow'), setNavigationUIEnabled: async () => calls.push('enable') };
  const nodes = type => { const found = []; const visit = n => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(visit); if (n.type === type) found.push(n); visit(n.props?.children); }; visit(tree); return found; };
  const render = () => { cursor = 0; tree = exports.GuidanceMap({ topInset: 44 }); while (effects.length) effects.shift()(); };
  render();
  return { render, calls, controller, view: () => nodes('NavigationView')[0].props, recenter: () => nodes('Pressable').find(n => n.props.accessibilityLabel === 'Recenter navigation').props };
}

for (const order of ['controller-first', 'map-first']) test(`waits for native map readiness and controller (${order})`, () => {
  const h = harness();
  assert.equal(h.view().navigationUIEnabledPreference, 0);
  assert.equal(h.recenter().disabled, true);
  if (order === 'controller-first') h.view().onNavigationViewControllerCreated(h.controller);
  else h.view().onMapReady();
  h.render(); h.recenter().onPress(); assert.deepEqual(h.calls, []);
  if (order === 'controller-first') h.view().onMapReady();
  else h.view().onNavigationViewControllerCreated(h.controller);
  h.render(); assert.deepEqual(h.calls, ['follow']);
  assert.equal(h.recenter().disabled, false);
  h.recenter().onPress(); assert.deepEqual(h.calls, ['follow', 'follow']);
  h.render(); assert.deepEqual(h.calls, ['follow', 'follow']);
});
