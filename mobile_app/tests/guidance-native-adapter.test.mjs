import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createGuidanceSession } from '../src/navigation/guidance-session.ts';

const target = { owner: 'owner', runId: 'run', shipmentId: 'shipment', title: 'Delivery', latitude: 0, longitude: 0 };
function harness(platform = 'ios', overrides = {}) {
  const calls = [];
  const controller = {
    areTermsAccepted: async () => true,
    init: async () => { calls.push('init'); return 'ok'; },
    setBackgroundLocationUpdatesEnabled: enabled => calls.push(`background:${enabled}`),
    startUpdatingLocation: () => { calls.push('location:start'); },
    setDestination: async () => { calls.push('destination'); return calls.includes('location:start') ? 'OK' : 'LOCATION_DISABLED'; },
    setAudioGuidanceType: () => { calls.push('audio'); },
    startGuidance: async () => { calls.push('guidance:start'); },
    stopGuidance: async () => { calls.push('guidance:stop'); },
    clearDestinations: async () => { calls.push('destination:clear'); },
    stopUpdatingLocation: () => { calls.push('location:stop'); },
    cleanup: async () => { calls.push('cleanup'); },
    ...overrides,
  };
  const modules = {
    react: { createContext: () => ({}) },
    'react-native': { Platform: { OS: platform } },
    'expo-location': { requestBackgroundPermissionsAsync: async () => ({ status: 'granted' }) },
    'expo-notifications': { requestPermissionsAsync: async () => ({ granted: true }) },
    'expo-keep-awake': {}, '@/src/providers/auth-provider': {}, '@/src/lib/api': {},
    '@/src/components/dashboard/navigation-location': { currentNavigationLocation: async () => ({ latitude: 0, longitude: 0 }) },
    './guidance-session': { createGuidanceSession }, './navigation-sdk': {},
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/navigation/GuidanceProvider.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => modules[name] || {} });
  const adapter = exports.nativeAdapter(controller, { TravelMode: { DRIVING: 0 }, AudioGuidance: { SILENT: 0, VOICE_ALERTS_AND_GUIDANCE: 1, BLUETOOTH_AUDIO: 2 } });
  return { calls, session: createGuidanceSession(adapter) };
}

test('iOS starts SDK location before setting a destination and stops it on Exit', async () => {
  const h = harness(); await h.session.start(target);
  assert.equal(h.session.snapshot().phase, 'guiding');
  assert.deepEqual(h.calls, ['init', 'background:true', 'location:start', 'destination', 'audio', 'guidance:start']);
  await h.session.stop();
  assert.deepEqual(h.calls.slice(-5), ['guidance:stop', 'destination:clear', 'background:false', 'location:stop', 'cleanup']);
});
test('Android starts location before routing without calling the iOS background switch', async () => {
  const h = harness('android'); await h.session.start(target);
  assert.equal(h.session.snapshot().phase, 'guiding');
  assert.deepEqual(h.calls, ['init', 'location:start', 'destination', 'audio', 'guidance:start']);
});
test('failed routing cleans up the SDK location provider and permits retry', async () => {
  let status = 'NO_ROUTE_FOUND';
  const h = harness('ios', { setDestination: async () => status });
  await h.session.start(target);
  assert.equal(h.session.snapshot().phase, 'idle');
  assert.ok(h.calls.includes('background:false')); assert.ok(h.calls.includes('location:stop'));
  assert.equal(h.calls.includes('guidance:start'), false);
  status = 'OK'; await h.session.start(target);
  assert.equal(h.session.snapshot().phase, 'guiding');
});
test('failed initialization never enables SDK location', async () => {
  const h = harness('ios', { init: async () => 'notAuthorized' }); await h.session.start(target);
  assert.equal(h.session.snapshot().phase, 'idle');
  assert.equal(h.calls.includes('location:start'), false);
  assert.equal(h.calls.includes('background:true'), false);
});
