import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForSdkLocation } from '../src/navigation/sdk-location.ts';

test('waits for a valid SDK fix, including zero coordinates, and removes listener', async () => {
  let listener, done = false;
  const ready = waitForSdkLocation(callback => { listener = callback; }, () => {}, () => true, 1000).then(() => { done = true; });
  await Promise.resolve(); assert.equal(done, false);
  listener({ lat: NaN, lng: 0 }); await Promise.resolve(); assert.equal(done, false);
  listener({ lat: 0, lng: 0 }); await ready;
  assert.equal(done, true); assert.equal(listener, null);
});
test('times out without routing and releases its listener', async () => {
  let listener;
  await assert.rejects(waitForSdkLocation(callback => { listener = callback; }, () => {}, () => true, 10), /navigation location/);
  assert.equal(listener, null);
});
test('cancellation releases the pending SDK fix wait', async () => {
  let listener, current = true;
  const ready = waitForSdkLocation(callback => { listener = callback; }, () => {}, () => current);
  current = false;
  await assert.rejects(ready, /cancelled/); assert.equal(listener, null);
});
