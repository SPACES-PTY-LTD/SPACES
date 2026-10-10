import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  let permission = 'granted', requested = 0, acquired = 0, timeout, point = { coords: { latitude: 0, longitude: 0 }, timestamp: Date.now() };
  const location = {
    Accuracy: { High: 'high' },
    getForegroundPermissionsAsync: async () => ({ status: permission }),
    requestForegroundPermissionsAsync: async () => { requested++; return { status: permission }; },
    getCurrentPositionAsync: async options => { assert.equal(options.accuracy, 'high'); acquired++; return point; },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/dashboard/navigation-location.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: () => location, Date, Number, Math, Promise, Error,
    setTimeout: (fn, ms) => { assert.equal(ms, 20000); timeout = fn; return 1; }, clearTimeout: () => { timeout = undefined; },
  });
  return { get: exports.currentNavigationLocation, location, setPermission: value => { permission = value; }, setPoint: value => { point = value; }, requested: () => requested, acquired: () => acquired, timeout: () => timeout?.() };
}
test('requests a high-accuracy current foreground fix, including zero coordinates, without background reporting', async () => {
  const h = harness(); const point = await h.get(() => true);
  assert.equal(point.latitude, 0); assert.equal(point.longitude, 0); assert.ok(point.reportedAt);
  assert.equal(h.requested(), 0); assert.equal(h.acquired(), 1);
});
test('denied permission and cancellation never acquire a position', async () => {
  const h = harness(); h.setPermission('denied');
  await assert.rejects(h.get(() => true), /Allow phone location/);
  assert.equal(h.requested(), 1); assert.equal(h.acquired(), 0);
  await assert.rejects(h.get(() => false), /cancelled/);
  assert.equal(h.requested(), 1); assert.equal(h.acquired(), 0);
});
test('rejects stale, future and invalid fixes instead of using a truck or cached origin', async () => {
  const h = harness();
  for (const point of [
    { coords: { latitude: 0, longitude: 0 }, timestamp: Date.now() - 31000 },
    { coords: { latitude: 0, longitude: 0 }, timestamp: Date.now() + 11000 },
    { coords: { latitude: 91, longitude: 0 }, timestamp: Date.now() },
  ]) { h.setPoint(point); await assert.rejects(h.get(() => true), /current phone location is unavailable/); }
});
test('bounds GPS waits and ignores a late fix after navigation is cancelled', async () => {
  const h = harness(); let resolve, current = true;
  h.location.getCurrentPositionAsync = () => new Promise(done => { resolve = done; });
  const pending = h.get(() => current); for (let i = 0; i < 15; i++) await Promise.resolve();
  h.timeout(); await assert.rejects(pending, /Unable to get/);
  const cancelled = h.get(() => current); for (let i = 0; i < 15; i++) await Promise.resolve();
  current = false; resolve({ coords: { latitude: 0, longitude: 0 }, timestamp: Date.now() });
  await assert.rejects(cancelled, /cancelled/);
});

test('automatic refresh does not repeat a denied permission prompt', async () => {
  const h = harness(); h.setPermission('denied');
  await assert.rejects(h.get(() => true, false), /Allow phone location/);
  assert.equal(h.requested(), 0); assert.equal(h.acquired(), 0);
});
