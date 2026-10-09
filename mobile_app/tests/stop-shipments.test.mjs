import test from 'node:test';
import assert from 'node:assert/strict';
import { shipmentsAtStop, stopShipmentStatus } from '../src/components/dashboard/stop-shipments.ts';

const location = (id, name = 'Depot', full_address = '10 Main Road') => ({ location_id: id, name, full_address });
const shipment = (id, pickup, dropoff) => ({ shipment_id: id, pickup_location: pickup, dropoff_location: dropoff, status: 'booked', booking: { status: 'booked' }, run_status: 'in_progress' });
const depot = location('depot');
const other = location('other', 'Store', '20 Store Road');

test('saved location groups all run deliveries and collections, including completed deliveries', () => {
  const delivery = { ...shipment('delivery', other, depot), status: 'delivered' };
  const collection = shipment('collection', depot, other);
  const both = shipment('both', depot, depot);
  const unrelated = shipment('unrelated', other, other);
  const groups = shipmentsAtStop({ location_id: 'depot', kind: 'Delivery', shipments: [{ shipment_id: 'delivery' }] }, [delivery, collection, both, unrelated, collection]);
  assert.deepEqual(groups.deliveries.map(s => s.shipment_id), ['delivery', 'both']);
  assert.deepEqual(groups.collections.map(s => s.shipment_id), ['collection', 'both']);
});

test('legacy timeline resolves only exact and unambiguous name plus full address', () => {
  const stop = { name: '  DEPOT ', address: '10  Main Road', kind: 'Collection' };
  const row = shipment('collection', depot, other);
  assert.deepEqual(shipmentsAtStop(stop, [row]).collections, [row]);
  assert.deepEqual(shipmentsAtStop({ ...stop, address: 'Wrong address' }, [row]), { deliveries: [], collections: [] });
  const ambiguous = shipment('ambiguous', location('another-depot'), other);
  assert.deepEqual(shipmentsAtStop(stop, [row, ambiguous]), { deliveries: [], collections: [] });
});

test('explicit missing IDs, speeding and absent stops never infer shipments', () => {
  const rows = [shipment('one', depot, depot)];
  for (const stop of [null, { location_id: null, name: 'Depot', address: '10 Main Road' }, { location_id: 'depot', kind: 'Speeding' }]) {
    assert.deepEqual(shipmentsAtStop(stop, rows), { deliveries: [], collections: [] });
  }
});

test('shipment cards display booking status with a shipment status fallback', () => {
  const row = shipment('one', depot, other);
  assert.equal(stopShipmentStatus({ ...row, booking: { status: 'failed' } }), 'Failed Delivery');
  assert.equal(stopShipmentStatus({ ...row, booking: null, status: 'in_transit' }), 'In transit');
});
