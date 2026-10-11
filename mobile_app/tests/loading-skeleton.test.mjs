import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  let resolve, reject, listener, cleanup;
  const calls = { starts: 0, stops: 0, removed: 0 };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    react: { useState: init => [init()], useEffect: fn => { cleanup = fn(); } },
    'react-native': {
      View: 'view',
      Animated: { View: 'animated', Value: class { setValue() {} }, timing: () => ({}), sequence: () => ({}), loop: () => ({ start: () => calls.starts++, stop: () => calls.stops++ }) },
      AccessibilityInfo: { isReduceMotionEnabled: () => new Promise((yes, no) => { resolve = yes; reject = no; }), addEventListener: (_, fn) => { listener = fn; return { remove: () => calls.removed++ }; } },
    },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'light' }) },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../component/ui/LoadingSkeleton.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => modules[name] });
  const tree = exports.LoadingSkeleton({ kind: 'runs', label: 'Loading runs' });
  return { tree, calls, resolve: value => resolve(value), reject: () => reject(Error('Unavailable')), change: value => listener(value), cleanup: () => cleanup() };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('one accessible loading section pulses and stops when unmounted', async () => {
  const h = harness(); h.resolve(false); await flush();
  assert.equal(h.calls.starts, 1);
  assert.equal(h.tree.props.accessibilityLabel, 'Loading runs');
  assert.equal(h.tree.props.accessibilityState.busy, true);
  assert.equal(h.tree.props.children.props.importantForAccessibility, 'no-hide-descendants');
  h.cleanup(); assert.equal(h.calls.stops, 1); assert.equal(h.calls.removed, 1);
});

test('Reduce Motion keeps placeholders static and runtime changes stop the pulse', async () => {
  const h = harness(); h.resolve(true); await flush(); assert.equal(h.calls.starts, 0);
  h.change(false); assert.equal(h.calls.starts, 1);
  h.change(true); assert.equal(h.calls.stops, 1);
});

test('late preference result cannot restart motion after an accessibility change', async () => {
  const h = harness(); h.change(true); h.resolve(false); await flush();
  assert.equal(h.calls.starts, 0);
});

test('late preference result after dismissal and failed preference reads remain static', async () => {
  const h = harness(); h.cleanup(); h.resolve(false); await flush(); assert.equal(h.calls.starts, 0);
  const failed = harness(); failed.reject(); await flush(); assert.equal(failed.calls.starts, 0);
});
