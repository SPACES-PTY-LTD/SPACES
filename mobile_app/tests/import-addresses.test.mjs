import test from 'node:test';
import assert from 'node:assert/strict';
import { shipmentAddressDraft, collectionFromRunStart } from '../src/lib/import-addresses.ts';

test('missing collection, delivery or both never inherit document addresses', () => {
  const address = { name: 'Document depot', address_line_1: '10 Main Road' };
  for (const [pickup, dropoff] of [[null, address], [address, null], [null, null]]) {
    const document = { pickup_address: address, dropoff_address: address, line_items: [{ pickup_address: pickup, dropoff_address: dropoff }] };
    assert.deepEqual(shipmentAddressDraft(document.line_items[0]), { pickup_address: pickup ?? {}, dropoff_address: dropoff ?? {} });
  }
  assert.deepEqual(shipmentAddressDraft({}), { pickup_address: {}, dropoff_address: {} });
});

test('partial extracted addresses and persisted driver selections survive draft restoration', () => {
  const selected = { pickup_location_id: 'saved-depot', pickup_address: { name: 'Selected depot', address_line_1: '8 Driver Road' }, dropoff_address: { city: 'Cape Town' } };
  const restored = JSON.parse(JSON.stringify(selected));
  assert.deepEqual({ ...restored, ...shipmentAddressDraft(restored) }, selected);
});


test('missing collection defaults to run start and delivery remains independent', () => {
  const start = { location_id: 'start-a', name: 'Run depot', address_line_1: '10 Depot Road', city: 'Cape Town' };
  for (const pickup_address of [undefined, null, {}, { address_line_1: null }, { name: 'Unresolved depot' }]) {
    const result = collectionFromRunStart({ pickup_address, dropoff_address: {} }, start);
    assert.equal(result.pickup_location_id, 'start-a');
    assert.equal(result.pickup_address.address_line_1, '10 Depot Road');
    assert.equal(result.pickup_from_run_start, true);
    assert.deepEqual(result.dropoff_address, {});
  }
});

test('inherited collection follows changed starting point and survives restored drafts', () => {
  const first = { location_id: 'start-a', address_line_1: 'First depot' };
  const next = { location_id: 'start-b', address_line_1: 'Next depot' };
  const restored = JSON.parse(JSON.stringify(collectionFromRunStart({}, first)));
  const updated = collectionFromRunStart(restored, next);
  assert.equal(updated.pickup_location_id, 'start-b');
  assert.equal(updated.pickup_address.address_line_1, 'Next depot');
  assert.equal(collectionFromRunStart(updated).pickup_location_id, null);
});

test('explicit and partial collections are never replaced by run start', () => {
  const origin = { location_id: 'run-start', address_line_1: 'Run road' };
  for (const row of [{ pickup_address: { city: 'Partial city' } }, { pickup_location_id: 'driver-selected', pickup_address: {} }, { pickup_address: { address_line_1: 'Extracted road' } }]) {
    assert.deepEqual(collectionFromRunStart(row, origin), row);
  }
});
