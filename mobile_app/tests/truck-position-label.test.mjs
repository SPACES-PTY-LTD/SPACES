import test from 'node:test';
import assert from 'node:assert/strict';
import { reportedAddress, truckPositionDescription } from '../src/components/dashboard/truck-position-label.ts';

test('reported address rejects coordinate-only and malformed data', () => {
  for (const value of [null, [], {}, { latitude: '-26.15', longitude: '28.04' }, { speed: '90', name: 'Truck' }]) assert.equal(reportedAddress(value), null);
  assert.equal(reportedAddress({ address_line_1: ' 37 Brewery St ', city: 'Kempton Park', country: 'ZA' }), '37 Brewery St, Kempton Park, ZA');
  assert.equal(reportedAddress({ formatted_address: 'Reported road', address_line_1: 'Other' }), 'Reported road');
});

test('geofence popup prefers its name and own address over the reported road', () => {
  const position = { address: 'Reported road', updated_at: null, geofence_location: { name: 'Isando Depot', address: 'Depot address' } };
  assert.equal(truckPositionDescription(position), 'Isando Depot\nDepot address\nLast reported position · update time unknown');
  assert.equal(truckPositionDescription({ ...position, geofence_location: { name: 'Isando Depot', address: null } }), 'Isando Depot\nLast reported position · update time unknown');
  assert.equal(truckPositionDescription({ ...position, geofence_location: null }), 'Reported road\nLast reported position · update time unknown');
});

test('old API and invalid timestamps keep truthful fallback text', () => {
  assert.equal(truckPositionDescription({ updated_at: 'bad date' }), 'Last reported position · update time unknown');
  assert.match(truckPositionDescription({ address: 'Known road', updated_at: '2026-10-09T07:00:00Z' }), /^Known road\nLast reported /);
});
