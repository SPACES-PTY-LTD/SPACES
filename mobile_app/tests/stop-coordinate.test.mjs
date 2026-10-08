import test from 'node:test';
import assert from 'node:assert/strict';
import { stopCoordinate } from '../src/components/dashboard/run-map-data.ts';
const coordinate = { latitude: -26.076, longitude: 28.012 };
const location = { name: 'Saved location', full_address: '4 Holt St, Sandton', ...coordinate };
const shipment = { shipment_id: 'owned-shipment', dropoff_location: location };
const stop = { name: location.name, address: location.full_address, kind: 'Delivery', shipments: [{ shipment_id: shipment.shipment_id }] };

test('older timeline reuses exact saved location from a linked authorized shipment', () => {
  assert.deepEqual(stopCoordinate(stop, [shipment]), coordinate);
  assert.deepEqual(stopCoordinate({ ...stop, address: ' 4 Holt St,  Sandton ' }, [shipment]), coordinate);
});
test('direct event coordinates take precedence and explicit invalid pairs stay unavailable', () => {
  assert.deepEqual(stopCoordinate({ ...stop, latitude: 0, longitude: 0 }, [shipment]), { latitude: 0, longitude: 0 });
  assert.equal(stopCoordinate({ ...stop, latitude: null, longitude: null }, [shipment]), null);
  assert.equal(stopCoordinate({ ...stop, latitude: 91, longitude: 28 }, [shipment]), null);
});
test('never substitutes saved location for missing speeding event position', () => {
  assert.equal(stopCoordinate({ ...stop, kind: 'Speeding' }, [shipment]), null);
});
test('unrelated shipments, mismatched identity and ambiguous coordinate matches are rejected', () => {
  assert.equal(stopCoordinate(stop, [{ ...shipment, shipment_id: 'not-linked' }]), null);
  assert.equal(stopCoordinate({ ...stop, name: 'Different place' }, [shipment]), null);
  assert.equal(stopCoordinate({ ...stop, address: null }, [shipment]), null);
  assert.equal(stopCoordinate(stop, [{ ...shipment, pickup_location: { ...location, latitude: -25 } }]), null);
});
test('exact authorized planned endpoint is usable without linked shipments', () => {
  assert.deepEqual(stopCoordinate({ ...stop, shipments: [] }, [], [{ name: location.name, address: location.full_address, ...coordinate }]), coordinate);
  assert.equal(stopCoordinate({ ...stop, shipments: [] }, []), null);
});
