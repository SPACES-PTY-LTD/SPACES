import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness({ enabled = false, granted = true, background = true } = {}) {
  const slots = [], effects = [], timers = new Map();
  let cursor = 0, context, appListener, timerId = 0;
  let server = { enabled, last_reported_at: null, dispatch_alerted_at: null };
  let backgroundStarted = 0, backgroundStopped = 0, backgroundRequested = 0;
  let permission = granted, reportCount = 0, requestCount = 0, saveCount = 0, failSave = false, position = null, permissionResult = null;
  const appState = { currentState: 'active', addEventListener: (_, callback) => { appListener = callback; return { remove() {} }; } };
  const location = {
    Accuracy: { Balanced: 3 },
    requestBackgroundPermissionsAsync: async () => { backgroundRequested++; return { granted: background }; },
    getBackgroundPermissionsAsync: async () => ({ granted: background }),
    requestForegroundPermissionsAsync: async () => { requestCount++; return permissionResult ? await permissionResult : { granted: permission }; },
    getForegroundPermissionsAsync: async () => ({ granted: permission }),
    getCurrentPositionAsync: async () => position ? await position : { coords: { latitude: 0, longitude: 0, accuracy: 5 }, timestamp: Date.now() },
  };
  let authSession = { token: 'test-token', user: { user_id: 'driver', role: 'driver' } };
  const modules = {
    '@/src/lib/phone-location-task': { backgroundLocationAvailable: async () => true, startPhoneLocation: async () => { backgroundStarted++; }, stopPhoneLocation: async () => { backgroundStopped++; } },
    react: {
      createContext: () => ({ Provider: 'provider' }), useContext: () => context,
      useState: initial => { const i = cursor++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
      useRef: initial => { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
      useCallback: (callback, deps) => { const i = cursor++; if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) slots[i] = { deps, callback }; return slots[i].callback; },
      useEffect: (effect, deps) => { const i = cursor++; if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) { slots[i]?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = effect(); }); } },
    },
    'react/jsx-runtime': { jsx: (_, props) => { context = props.value; return null; } },
    'react-native': { AppState: appState }, './auth-provider': { useAuth: () => ({ session: authSession, isHydrating: false }) },
    'expo-location': location,
    '@/src/lib/api': { driverApi: {
      locationSharing: async () => ({ ...server }),
      setLocationSharing: async (_, value) => { saveCount++; if (failSave) throw new Error('Network unavailable'); server = { ...server, enabled: value }; return { ...server }; },
      reportPhoneLocation: async () => { reportCount++; return { ...server, last_reported_at: new Date().toISOString() }; },
    } },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/providers/phone-location-provider.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; }, Date, Error, setInterval: callback => { timers.set(++timerId, callback); return timerId; }, clearInterval: id => timers.delete(id) });
  function render() { cursor = 0; exports.PhoneLocationProvider({}); while (effects.length) effects.shift()(); }
  return {
    render, async flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); render(); for (let i = 0; i < 20; i++) await Promise.resolve(); render(); },
    get value() { return context; }, get reportCount() { return reportCount; }, get requestCount() { return requestCount; },
    get backgroundStarted() { return backgroundStarted; }, get backgroundStopped() { return backgroundStopped; }, get backgroundRequested() { return backgroundRequested; },
    logout() { authSession = null; render(); },
    get saveCount() { return saveCount; }, deferPermission: value => { permissionResult = value; },
    setPermission: value => { permission = value; }, failSave: () => { failSave = true; }, deferPosition: value => { position = value; },
    background() { appState.currentState = 'background'; appListener('background'); render(); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('opted-out drivers never prompt for permission or report coordinates', async () => {
  const app = harness(); app.render(); await app.flush();
  assert.equal(app.value.settings.enabled, false); assert.equal(app.requestCount, 0); assert.equal(app.reportCount, 0); app.unmount();
});
test('enabling requires foreground/background consent and starts native reporting', async () => {
  const app = harness(); app.render(); await app.flush(); await app.value.setEnabled(true); await app.flush();
  assert.equal(app.requestCount, 1); assert.equal(app.backgroundRequested, 1); assert.ok(app.backgroundStarted > 0); assert.equal(app.value.settings.enabled, true); assert.equal(app.reportCount, 1); app.unmount();
});
test('permission denial cannot enable sharing', async () => {
  const app = harness({ granted: false }); app.render(); await app.flush();
  await assert.rejects(app.value.setEnabled(true), /Allow location access/); await app.flush();
  assert.equal(app.value.settings.enabled, false); assert.equal(app.value.permissionRequired, true); assert.equal(app.reportCount, 0); app.unmount();
});
test('positions completing after backgrounding or logout are not transmitted', async () => {
  for (const action of ['background', 'unmount']) {
    const app = harness({ enabled: true }); let resolve;
    app.deferPosition(new Promise(done => { resolve = done; })); app.render(); await app.flush(); app[action]();
    resolve({ coords: { latitude: 10, longitude: 20, accuracy: 5 }, timestamp: Date.now() });
    for (let i = 0; i < 20; i++) await Promise.resolve();
    assert.equal(app.reportCount, 0); if (action !== 'unmount') app.unmount();
  }
});
test('failed disable retains the saved setting and exposes retry feedback', async () => {
  const app = harness({ enabled: true }); app.render(); await app.flush(); app.failSave();
  await assert.rejects(app.value.setEnabled(false), /Network unavailable/); app.render();
  assert.equal(app.value.settings.enabled, true); assert.equal(app.value.error, 'Network unavailable'); app.unmount();
});
test('revoked device permission disables sharing without prompting again', async () => {
  const app = harness({ enabled: true, granted: false }); app.render(); await app.flush();
  assert.equal(app.value.settings.enabled, false); assert.equal(app.requestCount, 0); assert.equal(app.reportCount, 0); app.unmount();
});
test('permission completing after logout cannot enable sharing', async () => {
  const app = harness(); app.render(); await app.flush(); let resolve;
  app.deferPermission(new Promise(done => { resolve = done; }));
  const enabling = app.value.setEnabled(true);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  app.unmount(); resolve({ granted: true }); await enabling;
  assert.equal(app.saveCount, 0); assert.equal(app.reportCount, 0);
});

test('background permission denial never enables new sharing', async () => {
  const app = harness({ background: false }); app.render(); await app.flush();
  await assert.rejects(app.value.setEnabled(true), /Choose Always/); await app.flush();
  assert.equal(app.saveCount, 0); assert.equal(app.value.settings.enabled, false);
  assert.equal(app.backgroundStarted, 0); app.unmount();
});
test('backgrounding retains native sharing; logout stops it and clears visible settings', async () => {
  const app = harness({ enabled: true }); app.render(); await app.flush();
  const stopped = app.backgroundStopped;
  app.background(); await app.flush(); assert.equal(app.backgroundStopped, stopped);
  app.logout(); await app.flush(); assert.ok(app.backgroundStopped > stopped);
  assert.equal(app.value.settings, null); app.unmount();
});
test('logout during permission request cannot save opt-in for an old session', async () => {
  const app = harness(); app.render(); await app.flush(); let resolve;
  app.deferPermission(new Promise(done => { resolve = done; }));
  const enabling = app.value.setEnabled(true); await app.flush(); app.logout();
  resolve({ granted: true }); await enabling;
  assert.equal(app.saveCount, 0); app.unmount();
});
