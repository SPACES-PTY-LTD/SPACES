import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRunStops } from '../src/components/dashboard/run-stop-filter.ts';

test('both views preserve stop order; delivery view includes visited and planned deliveries but excludes collections', () => {
  const stops = [
    { stop_id: 'collection', kind: 'Collection', shipments: [{ shipment_id: 'a' }, { shipment_id: 'b' }] },
    { stop_id: 'break', shipments: [] },
    { stop_id: 'delivery', kind: 'Delivery', shipments: [{ shipment_id: 'a' }] },
    { stop_id: 'planned', kind: 'Delivery', planned: true, shipments: [{ shipment_id: 'b' }] },
    { stop_id: 'speeding', kind: 'Speeding', shipments: [] },
    { stop_id: 'other' },
  ];
  assert.deepEqual(filterRunStops(stops, 'all'), stops);
  assert.deepEqual(filterRunStops(stops, 'shipments').map(s => s.stop_id), ['delivery', 'planned']);
  assert.deepEqual(filterRunStops(stops, 'speeding').map(s => s.stop_id), ['speeding']);
  assert.deepEqual(filterRunStops([], 'shipments'), []);
});
