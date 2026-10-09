import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness() {
  const store = new Map(); let task, started = false, background = true, reports = 0;
  let session = { token: 'token', user: { user_id: 'driver', role: 'driver' } };
  let settings = { enabled: true }; let failReport;
  const location = {
    Accuracy: { Balanced: 3 }, getBackgroundPermissionsAsync: async () => ({ granted: background }),
    hasStartedLocationUpdatesAsync: async () => started,
    startLocationUpdatesAsync: async (_, options) => { assert.equal(options.pausesUpdatesAutomatically, false); assert.ok(options.foregroundService); started = true; },
    stopLocationUpdatesAsync: async () => { started = false; },
  };
  const modules = {
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async key => store.get(key) ?? null, setItem: async (key, value) => store.set(key, value), removeItem: async key => store.delete(key) } },
    'expo-location': location, 'react-native': { Platform: { OS: 'ios' } },
    'expo-task-manager': { isAvailableAsync: async () => true, isTaskDefined: () => false, defineTask: (_, callback) => { task = callback; } },
    './auth-storage': { readSession: async () => session },
    './api': { driverApi: { locationSharing: async () => settings, reportPhoneLocation: async () => { if (failReport) throw failReport; reports++; } } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/phone-location-task.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; }, Date, Promise, Error });
  return { ...exports, get started() { return started; }, get reports() { return reports; },
    revoke() { background = false; }, logout() { session = null; }, remoteOff() { settings.enabled = false; }, fail(status) { failReport = { status }; },
    invoke(timestamp = Date.now()) { return task({ data: { locations: [{ timestamp, coords: { latitude: 1, longitude: 2, accuracy: 5 } }] } }); },
  };
}
test('registered native task reports with persisted opt-in and auth without foreground React', async () => {
  const app = harness(); await app.startPhoneLocation('driver'); await app.invoke(); assert.equal(app.reports, 1);
});
test('stopping locally prevents future transmission and stops native updates', async () => {
  const app = harness(); await app.startPhoneLocation('driver'); await app.stopPhoneLocation(); await app.invoke();
  assert.equal(app.reports, 0); assert.equal(app.started, false);
});
test('logout and remote disable both stop native sharing without reporting', async () => {
  for (const method of ['logout', 'remoteOff']) {
    const app = harness(); await app.startPhoneLocation('driver'); app[method](); await app.invoke();
    assert.equal(app.reports, 0); assert.equal(app.started, false);
  }
});
test('background permission denial never starts native updates', async () => {
  const app = harness(); app.revoke(); await assert.rejects(app.startPhoneLocation('driver'), /Allow background/);
  assert.equal(app.started, false);
});
test('old or pre-consent coordinates are discarded', async () => {
  const app = harness(); const before = Date.now() - 1000; await app.startPhoneLocation('driver'); await app.invoke(before);
  await app.invoke(Date.now() - 600000); assert.equal(app.reports, 0);
});
test('authorization/off errors stop updates; transient network errors keep next-update retry', async () => {
  for (const status of [401, 403, 409, 500]) {
    const app = harness(); await app.startPhoneLocation('driver'); app.fail(status); await app.invoke();
    assert.equal(app.started, status === 500); assert.equal(app.reports, 0);
  }
});
