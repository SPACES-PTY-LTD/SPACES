import test from 'node:test';
import assert from 'node:assert/strict';
import { shipmentAddressDraft } from '../src/lib/import-addresses.ts';

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
