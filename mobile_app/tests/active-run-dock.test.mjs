import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  let now = Date.parse('2026-10-10T10:00:00Z'), value, focus, cleanup, listener, tick, opened = 0;
  const native = { View: 'View', Pressable: 'Pressable', StyleSheet: { create: x => x }, AppState: { currentState: 'active', addEventListener: (_, fn) => { listener = fn; return { remove() { listener = undefined; } }; } } };
  const modules = {
    react: { useState: initial => { value ??= initial(); return [value, x => { value = x; }]; }, useCallback: fn => fn },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { useFocusEffect: fn => { focus = fn; } },
    'react-native': native,
    '@/component/ui/Text': { Text: 'Text' },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'light' }) },
  };
  class Clock extends Date { static now() { return now; } }
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/dashboard/ActiveRunDock.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require: name => modules[name], Date: Clock,
    setInterval: (fn, ms) => { assert.equal(ms, 1000); tick = fn; return 1; }, clearInterval: () => { tick = undefined; },
  });
  const render = () => exports.ActiveRunDock({ startedAt: '2026-10-10T08:00:00Z', endpoints: [], onActions: () => opened++, onHeightChange() {} });
  return { exports, render, focus: () => { cleanup = focus(); }, blur: () => cleanup(), advance: ms => { now += ms; tick?.(); }, state: state => { native.AppState.currentState = state; listener(state); }, ticking: () => !!tick, opened: () => opened };
}
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; return [tree, ...[tree.props?.children].flat().flatMap(nodes)]; }

test('elapsed time preserves long runs, seconds, timezone offsets and missing starts', () => {
  const { elapsedRunTime } = harness().exports;
  const now = Date.parse('2026-10-10T12:00:00Z');
  assert.equal(elapsedRunTime('2026-10-09T08:45:24Z', now), '27:14:36');
  assert.equal(elapsedRunTime('2026-10-10T12:00:00+02:00', now), '02:00:00');
  assert.equal(elapsedRunTime('2026-10-11T12:00:00Z', now), '00:00:00');
  for (const start of [undefined, null, '', 'invalid']) assert.equal(elapsedRunTime(start, now), 'Time unavailable');
});

test('route uses planned run endpoints and honest fallbacks', () => {
  const { activeRunRoute } = harness().exports;
  assert.equal(activeRunRoute([{ role: 'Delivery', name: 'Wrong stop' }, { role: 'Run starting point', name: ' A ' }, { role: 'Planned end location', name: 'B' }]), 'From A → B');
  assert.equal(activeRunRoute([]), 'From Start unavailable → End not set');
});

test('clock reconciles background and focus gaps while Actions remains independently usable', () => {
  const h = harness(); h.render(); h.focus(); h.advance(1000);
  assert.ok(nodes(h.render()).some(n => n.props.children === '02:00:01'));
  h.state('background'); assert.equal(h.ticking(), false); h.advance(60_000); h.state('active');
  assert.ok(nodes(h.render()).some(n => n.props.children === '02:01:01'));
  nodes(h.render()).find(n => n.props.accessibilityLabel === 'Run actions').props.onPress(); assert.equal(h.opened(), 1);
  h.blur(); assert.equal(h.ticking(), false); h.advance(120_000); h.render(); h.focus();
  assert.ok(nodes(h.render()).some(n => n.props.children === '02:03:01'));
  h.blur();
});
