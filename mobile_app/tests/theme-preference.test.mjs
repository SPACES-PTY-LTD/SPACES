import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(stored = null) {
  let observed = 'dark', appListener, layoutEffect, effect;
  const calls = [], pending = [];
  const modules = {
    '@react-native-async-storage/async-storage': { getItem: async () => stored, setItem: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) },
    nativewind: { colorScheme: { set: value => { calls.push(value); observed = value === 'system' ? 'dark' : value; } }, useColorScheme: () => ({ colorScheme: observed }) },
    'react-native': { AppState: { addEventListener: (_, listener) => { appListener = listener; return { remove: () => { appListener = undefined; } }; } } },
    react: { useSyncExternalStore: (_, getSnapshot) => getSnapshot(), useLayoutEffect: fn => { layoutEffect = fn; }, useEffect: fn => { effect = fn; } },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/lib/theme-preference.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { exports, require: name => modules[name] });
  return { api: exports, calls, pending, drift: value => { observed = value; }, render: () => { exports.useThemeSynchronization(); layoutEffect(); }, mount: () => { exports.useThemeSynchronization(); layoutEffect(); return effect(); }, resume: () => appListener?.('active') };
}

test('default light corrects dark utility styles and foreground drift', () => {
  const h = harness();
  const cleanup = h.mount();
  assert.deepEqual(h.calls, ['light']);
  h.drift('dark'); h.resume();
  assert.deepEqual(h.calls, ['light', 'light']);
  cleanup(); h.resume();
  assert.equal(h.calls.length, 2);
});

test('explicit light is reapplied when native appearance drifts', async () => {
  const h = harness('light'); await h.api.restoreThemePreference();
  h.drift('dark'); h.render();
  assert.deepEqual(h.calls, ['light', 'light']);
  h.render(); assert.equal(h.calls.length, 2);
});

test('explicit dark stays dark despite light OS appearance', async () => {
  const h = harness('dark'); await h.api.restoreThemePreference();
  h.drift('light'); h.render();
  assert.deepEqual(h.calls, ['dark', 'dark']);
  assert.equal(h.api.useThemePreference(), 'dark');
});

test('system preference does not force a light or dark override', async () => {
  const h = harness('system'); await h.api.restoreThemePreference();
  h.mount(); h.drift('light'); h.render();
  assert.deepEqual(h.calls, ['system']);
  h.resume(); assert.deepEqual(h.calls, ['system', 'system']);
});

test('missing or invalid stored preference applies default light', async () => {
  for (const value of [null, 'invalid']) {
    const h = harness(value); await h.api.restoreThemePreference();
    assert.deepEqual(h.calls, ['light']);
  }
});

test('out-of-order theme saves cannot overwrite the latest selection', async () => {
  const h = harness();
  const dark = h.api.setThemePreference('dark');
  const light = h.api.setThemePreference('light');
  h.pending[1].resolve(); await light;
  h.pending[0].resolve(); await dark;
  assert.equal(h.api.useThemePreference(), 'light');
  assert.deepEqual(h.calls, ['light']);
});

test('restore cannot overwrite a newer manual selection', async () => {
  const h = harness('dark');
  const restoring = h.api.restoreThemePreference();
  const selecting = h.api.setThemePreference('light');
  await restoring; h.pending[0].resolve(); await selecting;
  assert.deepEqual(h.calls, ['light']);
});

test('failed save retains selected theme and rejects for the settings error UI', async () => {
  const h = harness(); const saving = h.api.setThemePreference('dark');
  h.pending[0].reject(Error('Storage unavailable'));
  await assert.rejects(saving, /Storage unavailable/);
  assert.equal(h.api.useThemePreference(), 'light');
  assert.deepEqual(h.calls, []);
});
