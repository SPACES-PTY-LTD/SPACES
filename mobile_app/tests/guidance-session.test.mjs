import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuidanceSession } from '../src/navigation/guidance-session.ts';
const target = { owner: 'owner', runId: 'run', shipmentId: 'shipment', title: 'Delivery', latitude: 0, longitude: 0 };
function harness(overrides = {}) {
  const calls = [];
  const adapter = { prepare: async () => { calls.push('prepare'); return true; }, initialize: async () => { calls.push('init'); return 'ok'; }, destination: async t => { calls.push(t); return 'OK'; }, start: async () => { calls.push('start'); }, stop: async () => { calls.push('stop'); }, audio: async muted => { calls.push(muted); }, ...overrides };
  return { session: createGuidanceSession(adapter), calls };
}
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
test('duplicate starts are serialized; zero coordinates, mute, progress, reroute and arrival work', async () => {
  const { session, calls } = harness(); const first = session.start(target); await session.start(target); await first;
  assert.equal(calls.filter(c => c === 'start').length, 1); assert.equal(session.snapshot().phase, 'guiding');
  await session.mute(); assert.equal(session.snapshot().muted, true);
  session.progress(120, 1000); assert.equal(session.snapshot().seconds, 120);
  session.progress(NaN, -1); assert.equal(session.snapshot().seconds, 120);
  session.rerouting(); assert.equal(session.snapshot().rerouting, true);
  session.progress(110, 900); assert.equal(session.snapshot().rerouting, false);
  await session.arrived(); assert.equal(session.snapshot().phase, 'arrived');
  await session.stop(); assert.equal(session.snapshot().phase, 'idle');
});
test('cancel during permission, initialization, routing or native start never leaves guidance active', async () => {
  for (const step of ['prepare', 'initialize', 'destination', 'start']) {
    let resolve; const waiting = new Promise(done => { resolve = done; });
    const { session, calls } = harness({ [step]: () => waiting });
    const start = session.start(target); await settle(); const stop = session.stop();
    resolve(step === 'prepare' ? true : step === 'initialize' ? 'ok' : step === 'destination' ? 'OK' : undefined);
    await start; await stop;
    assert.equal(session.snapshot().phase, 'idle'); assert.equal(calls.at(-1), 'stop');
    if (step !== 'start') assert.equal(calls.includes('start'), false);
  }
});
test('refused terms, failed initialization and routing leave a retryable preview', async () => {
  for (const override of [{ prepare: async () => false }, { initialize: async () => 'notAuthorized' }, { initialize: async () => { throw new Error('Native init failed'); } }, { destination: async () => 'NO_ROUTE_FOUND' }, { start: async () => { throw new Error('Offline'); } }]) {
    const { session, calls } = harness(override); await session.start(target); assert.equal(session.snapshot().phase, 'idle');
    if (override.initialize || override.destination || override.start) assert.ok(calls.includes('stop'));
  }
  const { session } = harness(); await session.start({ ...target, latitude: 200 }); assert.equal(session.snapshot().phase, 'idle'); assert.match(session.snapshot().error, /coordinates/);
});
test('cleanup failure remains stoppable and blocks a new session until Exit succeeds', async () => {
  let fail = true;
  const { session } = harness({ stop: async () => { if (fail) throw new Error('native failure'); } });
  await session.start(target); await session.stop(); assert.equal(session.snapshot().phase, 'stopping');
  await session.start(target); assert.equal(session.snapshot().phase, 'stopping');
  fail = false; await session.stop(); assert.equal(session.snapshot().phase, 'idle');
  await session.start(target); assert.equal(session.snapshot().phase, 'guiding');
});
