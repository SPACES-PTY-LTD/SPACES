import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { alignGoogleMapsPodspec } = require('../plugins/with-google-maps-ios');
const podspec = readFileSync(new URL('../node_modules/react-native-maps/react-native-maps.podspec', import.meta.url), 'utf8');

test('overview and guidance resolve the same Maps framework, preserving native map sources', () => {
  const result = alignGoogleMapsPodspec(podspec);
  assert.match(result, /ss.dependency 'GoogleMaps', '10.13.0'/);
  assert.match(result, /ss.dependency 'Google-Maps-iOS-Utils', '7.0.0'/);
  assert.match(result, /ss.source_files = "ios\/AirGoogleMaps/);
  assert.match(result, /ss.dependency 'react-native-maps\/Maps'/);
  const sdkSpec = readFileSync(new URL('../node_modules/@googlemaps/react-native-navigation-sdk/react-native-navigation-sdk.podspec', import.meta.url), 'utf8');
  assert.match(sdkSpec, /s.dependency "GoogleNavigation", "10.13.0"/);
  assert.equal(alignGoogleMapsPodspec(result), result);
});

test('an unexpected upstream podspec fails instead of silently building an incompatible map', () => {
  assert.throws(() => alignGoogleMapsPodspec(podspec.replace(/'9.4.0'|'10.13.0'/, "'99.0.0'")), /Review iOS/);
});

test('iOS key enables the real Google overview subspec and survives guidance being disabled', () => {
  const originalKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
  const originalFlag = process.env.SPACES_NAVIGATION_ENABLED;
  try {
    process.env.GOOGLE_MAPS_IOS_API_KEY = 'test-only-not-a-real-key';
    process.env.SPACES_NAVIGATION_ENABLED = 'false';
    delete require.cache[require.resolve('../app.config')];
    const result = require('../app.config')({ config: {} });
    assert.equal(result.plugins.find(item => Array.isArray(item) && item[0] === 'react-native-maps')[1].iosGoogleMapsApiKey, 'test-only-not-a-real-key');
    assert.ok(result.plugins.includes('./plugins/with-google-maps-ios'));
    assert.equal(result.extra.navigationEnabled, false);
  } finally {
    if (originalKey === undefined) delete process.env.GOOGLE_MAPS_IOS_API_KEY; else process.env.GOOGLE_MAPS_IOS_API_KEY = originalKey;
    if (originalFlag === undefined) delete process.env.SPACES_NAVIGATION_ENABLED; else process.env.SPACES_NAVIGATION_ENABLED = originalFlag;
  }
});
