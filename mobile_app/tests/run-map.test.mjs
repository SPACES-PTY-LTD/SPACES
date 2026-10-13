import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRunMapEvents, groupRunMapStops, locationCoordinate, runMapStops } from '../src/components/dashboard/run-map-data.ts';

test('accepts numeric and decimal-string coordinates, including zero', () => {
  assert.deepEqual(locationCoordinate({ latitude: '-26.14', longitude: '28.04' }), { latitude: -26.14, longitude: 28.04 });
  assert.deepEqual(locationCoordinate({ latitude: 0, longitude: 0 }), { latitude: 0, longitude: 0 });
});

test('never turns missing or invalid coordinates into a map location', () => {
  for (const value of [null, {}, { latitude: '', longitude: '' }, { latitude: ' ', longitude: 10 }, { latitude: 91, longitude: 28 }, { latitude: 26, longitude: 181 }, { latitude: 'NaN', longitude: 20 }]) {
    assert.equal(locationCoordinate(value), null);
  }
});

test('keeps timeline numbering and completed shipments when some locations are missing', () => {
  const shipments = [
    { shipment_id: 'a', status: 'booked', dropoff_location: null },
    { shipment_id: 'b', status: 'delivered', dropoff_location: { latitude: -26, longitude: 28 } },
  ];
  const stops = runMapStops(shipments);
  assert.equal(stops.length, 1);
  assert.equal(stops[0].number, 2);
  assert.equal(stops[0].shipment.shipment_id, 'b');
  assert.deepEqual(runMapStops([]), []);
});

test('co-located shipments share one marker without losing their timeline numbers', () => {
  const stops = runMapStops([
    { shipment_id: 'a', status: 'delivered', dropoff_location: { latitude: -26.14, longitude: 28.04 } },
    { shipment_id: 'b', status: 'booked', dropoff_location: { latitude: -26.18, longitude: 28.04 } },
    { shipment_id: 'c', status: 'delivered', dropoff_location: { latitude: '-26.14', longitude: '28.04' } },
  ]);
  const groups = groupRunMapStops(stops);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].stops.map(stop => stop.number), [1, 3]);
  assert.deepEqual(groups[1].stops.map(stop => stop.number), [2]);
});


test('recorded event grouping validates coordinates, excludes plans and preserves co-located history', () => {
  const groups = groupRunMapEvents([
    { stop_id: 'stop', kind: 'Stop', latitude: 0, longitude: 0 },
    { stop_id: 'speed', kind: 'Speeding', latitude: '0', longitude: '0' },
    { stop_id: 'other', kind: 'Delivery', latitude: 1, longitude: 2 },
    { stop_id: 'plan', planned: true, latitude: 2, longitude: 2 },
    { stop_id: 'missing', latitude: null, longitude: null },
    { stop_id: 'invalid', latitude: 91, longitude: 0 },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].speeding, true);
  assert.deepEqual(groups[0].events.map(event => event.stop_id), ['stop', 'speed']);
  assert.equal(groups[1].speeding, false);
});
