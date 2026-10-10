import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  let now = Date.parse('2026-10-10T10:00:00Z'), value, focus, cleanup, listener, tick, opened = 0, revealed = 0;
  const native = { View: 'View', Pressable: 'Pressable', StyleSheet: { create: x => x }, AppState: { currentState: 'active', addEventListener: (_, fn) => { listener = fn; return { remove() { listener = undefined; } }; } } };
  const modules = {
    react: { useState: initial => { value ??= initial(); return [value, x => { value = x; }]; }, useCallback: fn => fn },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { useFocusEffect: fn => { focus = fn; } },
    'react-native': native,
    '@expo/vector-icons': { Feather: 'Feather' },
    '@/component/ui/Text': { Text: 'Text' },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'light' }) },
  };
  class Clock extends Date { static now() { return now; } }
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/dashboard/ActiveRunDock.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require: name => modules[name], Date: Clock,
    setInterval: (fn, ms) => { assert.equal(ms, 1000); tick = fn; return 1; }, clearInterval: () => { tick = undefined; },
  });
  const render = () => exports.ActiveRunDock({ startedAt: '2026-10-10T08:00:00Z', endpoints: [], showInfo: true, onShowTimeline: () => revealed++, actions: { type: 'Pressable', props: { accessibilityLabel: 'Run actions', onPress: () => opened++ } }, onHeightChange() {} });
  return { exports, render, focus: () => { cleanup = focus(); }, blur: () => cleanup(), advance: ms => { now += ms; tick?.(); }, state: state => { native.AppState.currentState = state; listener(state); }, ticking: () => !!tick, opened: () => opened, revealed: () => revealed };
}
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; return [tree, ...[tree.props?.children].flat().flatMap(nodes)]; }

test('elapsed time shows whole hours and minutes, timezone offsets and missing starts', () => {
  const { elapsedRunTime } = harness().exports;
  const now = Date.parse('2026-10-10T12:00:00Z');
  assert.equal(elapsedRunTime('2026-10-09T08:45:24Z', now), '27hrs 14mins');
  assert.equal(elapsedRunTime('2026-10-10T12:00:00+02:00', now), '2hrs 0mins');
  assert.equal(elapsedRunTime('2026-10-11T12:00:00Z', now), '0hrs 0mins');
  assert.equal(elapsedRunTime('2026-10-10T01:29:01Z', now), '10hrs 30mins');
  assert.equal(elapsedRunTime('2026-10-10T11:59:01Z', now), '0hrs 0mins');
  assert.equal(elapsedRunTime('2026-10-10T11:59:00Z', now), '0hrs 1min');
  assert.equal(elapsedRunTime('2026-10-10T10:59:00Z', now), '1hr 1min');
  for (const start of [undefined, null, '', 'invalid']) assert.equal(elapsedRunTime(start, now), 'Time unavailable');
});

test('route uses planned run endpoints and honest fallbacks', () => {
  const { activeRunRoute } = harness().exports;
  assert.equal(activeRunRoute([{ role: 'Delivery', name: 'Wrong stop' }, { role: 'Run starting point', name: ' A ' }, { role: 'Planned end location', name: 'B' }]), 'From A → B');
  assert.equal(activeRunRoute([]), 'From Start unavailable → End not set');
});

test('clock reconciles background and focus gaps while Actions remains independently usable', () => {
  const h = harness(); h.render(); h.focus(); h.advance(1000);
  assert.ok(nodes(h.render()).some(n => n.props.children === 'Run active for:'));
  assert.ok(nodes(h.render()).some(n => n.props.children === '2hrs 0mins'));
  h.state('background'); assert.equal(h.ticking(), false); h.advance(60_000); h.state('active');
  assert.ok(nodes(h.render()).some(n => n.props.children === '2hrs 1min'));
  nodes(h.render()).find(n => n.props.accessibilityLabel === 'Run actions').props.onPress(); assert.equal(h.opened(), 1);
  nodes(h.render()).find(n => n.props.accessibilityLabel === 'Show run timeline').props.onPress();
  assert.equal(h.revealed(), 1);
  for (const label of ['Show run timeline from elapsed time', 'Show run timeline from route']) nodes(h.render()).find(n => n.props?.accessibilityLabel === label).props.onPress();
  assert.equal(h.revealed(), 3); assert.equal(h.opened(), 1);
  h.blur(); assert.equal(h.ticking(), false); h.advance(120_000); h.render(); h.focus();
  assert.ok(nodes(h.render()).some(n => n.props.children === '2hrs 3mins'));
  h.blur();
});


test('run sheet drags reveal timeline and restore measured summary; default snaps remain', () => {
  const state = []; let cursor = 0, responder;
  const modules = {
    react: { useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], x => { state[i] = typeof x === 'function' ? x(state[i]) : x; }]; }, useMemo: fn => fn(), useEffect() {} },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { create: x => x }, PanResponder: { create: handlers => { responder = handlers; return { panHandlers: handlers }; } } },
    'react-native-reanimated': { withTiming: x => x }, './sheet-theme': { sheetTheme: {} },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'light' }) },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../component/ui/PersistentBottomSheet.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => modules[name] });
  const props = { containerHeight: 800, initialSnapIndex: 0, collapsedHeight: 126, header: expand => ({ type: 'RunHeader', props: { onShowTimeline: expand } }), children: { type: 'Timeline' } };
  const render = () => { cursor = 0; return exports.PersistentBottomSheet(props); };
  const height = () => render().props.style[1].height;
  assert.equal(height(), 126);
  const reveal = () => render().props.children[0].props.children[1].props.onShowTimeline();
  reveal(); assert.equal(height(), 400);
  responder.onPanResponderRelease(null, { dy: 274 }); assert.equal(height(), 126);
  assert.equal(responder.onMoveShouldSetPanResponderCapture(null, { dy: 3 }), false);
  assert.equal(responder.onMoveShouldSetPanResponderCapture(null, { dy: -100 }), true);
  responder.onPanResponderMove(null, { dy: -274 }); assert.equal(height(), 400);
  responder.onPanResponderRelease(null, { dy: -274 }); assert.equal(height(), 400);
  responder.onPanResponderRelease(null, { dy: -336 }); assert.equal(height(), 736);
  reveal(); assert.equal(height(), 736);
  responder.onPanResponderRelease(null, { dy: 610 }); assert.equal(height(), 126);
  props.collapsedHeight = 158; assert.equal(height(), 158);
  state.length = 0; props.initialSnapIndex = 1; delete props.collapsedHeight;
  assert.equal(height(), 400);
  responder.onPanResponderRelease(null, { dy: 200 }); assert.equal(height(), 200);
});
