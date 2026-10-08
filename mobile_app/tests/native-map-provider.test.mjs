import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeMapCapabilities, selectNativeMapProvider } from '../src/components/dashboard/native-map-provider.ts';
const choose = (platform, views, failed = new Set(), preferApple = false, isExpoGo = false) => selectNativeMapProvider(nativeMapCapabilities(platform, name => views.includes(name), { isExpoGo }), failed, preferApple);

test('iOS Expo Go selects Apple before mounting despite registered Google views', () => {
  for (const views of [['RNMapsMapView', 'RNMapsGoogleMapView'], ['AIRMap', 'AIRGoogleMap']]) {
    assert.equal(choose('ios', views, new Set(), false, true), 'apple');
    assert.equal(choose('ios', views, new Set(['apple']), false, true), 'unavailable');
  }
  assert.equal(choose('ios', ['RNMapsGoogleMapView'], new Set(), false, true), 'unavailable');
});
test('native development/release builds retain Google; Android Expo Go remains Google', () => {
  const views = ['RNMapsMapView', 'RNMapsGoogleMapView'];
  assert.equal(choose('ios', views, new Set(), false, false), 'google');
  assert.equal(choose('android', ['RNMapsMapView'], new Set(), false, true), 'google');
  assert.equal(choose('android', ['AIRMap'], new Set(), false, true), 'google');
});

test('iOS without Google native view uses Apple before mounting', () => {
  assert.equal(choose('ios', ['RNMapsMapView']), 'apple');
  assert.equal(choose('ios', ['AIRMap']), 'apple');
});
test('iOS preserves installed Google in Fabric and legacy builds', () => {
  assert.equal(choose('ios', ['RNMapsMapView', 'RNMapsGoogleMapView']), 'google');
  assert.equal(choose('ios', ['AIRMap', 'AIRGoogleMap']), 'google');
});
test('known Google render failure falls back to Apple; failure of both shows unavailable', () => {
  const views = ['RNMapsMapView', 'RNMapsGoogleMapView'];
  assert.equal(choose('ios', views, new Set(['google'])), 'apple');
  assert.equal(choose('ios', views, new Set(['google', 'apple'])), 'unavailable');
});
test('explicit recovery handles silent tile failure without a time-based inference', () => {
  const views = ['RNMapsMapView', 'RNMapsGoogleMapView'];
  assert.equal(choose('ios', views, new Set(), true), 'apple');
  assert.equal(choose('ios', views), 'google');
});
test('Android stays on Google or unavailable, never Apple', () => {
  assert.equal(choose('android', ['RNMapsMapView']), 'google');
  assert.equal(choose('android', ['AIRMap'], new Set(), true), 'google');
  assert.equal(choose('android', ['AIRMap'], new Set(['google'])), 'unavailable');
  assert.equal(choose('android', []), 'unavailable');
});
test('missing maps and non-native platforms never mount an unsupported provider', () => {
  assert.equal(choose('ios', []), 'unavailable');
  assert.equal(choose('web', ['RNMapsMapView', 'RNMapsGoogleMapView']), 'unavailable');
});
test('failed Google probe still permits registered Apple map', () => {
  const capabilities = nativeMapCapabilities('ios', name => {
    if (name.includes('Google')) throw Error('View absent');
    return name === 'RNMapsMapView';
  }, { isExpoGo: false });
  assert.equal(selectNativeMapProvider(capabilities, new Set()), 'apple');
});
