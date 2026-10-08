import test from 'node:test';
import assert from 'node:assert/strict';
import { runCardRoute } from '../src/components/runs/run-card-route.ts';

const origin = { name: 'Depot', address: '1 Main Road' };
const destination = { name: 'Planned depot', address: null };
const current_location = { name: 'N3', address: null };

test('active and ready runs without a planned end retain a separate current location and unknown future end', () => {
  for (const status of ['draft', 'dispatched', 'in_progress']) {
    const route = runCardRoute({ status, origin, destination: null, current_location });
    assert.deepEqual(route.map(s => s.label), ['Starting point', 'Current location', 'Planned end']);
    assert.equal(route[1].location, current_location);
    assert.equal(route[2].location, null);
    assert.equal(route[2].unknown, true);
  }
  assert.equal(runCardRoute({ status: 'in_progress', origin: null, destination: null })[1].location, null);
});

test('known planned endpoints remain planned, including completed runs without finish evidence', () => {
  for (const status of ['draft', 'in_progress', 'completed']) {
    const route = runCardRoute({ status, origin, destination, current_location });
    assert.equal(route.length, 2);
    assert.equal(route[1].label, 'Planned end');
    assert.equal(route[1].location, destination);
    assert.notEqual(route[1].unknown, true);
  }
});

test('completed history uses recorded finish evidence and never the current vehicle location', () => {
  const recorded_end = { name: 'Actual finish', address: null };
  const route = runCardRoute({ status: 'completed', origin, destination, current_location, recorded_end });
  assert.deepEqual(route[1], { label: 'End point', location: recorded_end });
  assert.deepEqual(runCardRoute({ status: 'completed', origin, destination: null, current_location })[1], {
    label: 'End point', location: null, unknown: true,
  });
});
