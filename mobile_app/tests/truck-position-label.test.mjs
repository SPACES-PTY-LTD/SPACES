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
  assert.equal(truckPositionDescription(position), 'Isando Depot\nDepot address\nMovement unknown\nLast reported position · update time unknown');
  assert.equal(truckPositionDescription({ ...position, geofence_location: { name: 'Isando Depot', address: null } }), 'Isando Depot\nMovement unknown\nLast reported position · update time unknown');
  assert.equal(truckPositionDescription({ ...position, geofence_location: null }), 'Reported road\nMovement unknown\nLast reported position · update time unknown');
});

test('old API and invalid timestamps keep truthful fallback text', () => {
  assert.equal(truckPositionDescription({ updated_at: 'bad date' }), 'Movement unknown\nLast reported position · update time unknown');
  assert.match(truckPositionDescription({ address: 'Known road', updated_at: '2026-10-09T07:00:00Z' }), /^Known road\nMovement unknown\nLast reported /);
});


test('motion uses reported speed and server threshold with truthful freshness', () => {
  const now = Date.parse('2026-10-09T12:00:00Z');
  const position = { updated_at: '2026-10-09T11:59:00Z', speed_kph: 0, motion_status: 'stationary' };
  assert.match(truckPositionDescription(position, now), /^Stationary · 0 km\/h/);
  assert.match(truckPositionDescription({ ...position, speed_kph: 3 }, now), /^Stationary · 3 km\/h/);
  assert.match(truckPositionDescription({ ...position, speed_kph: 42.25, motion_status: 'moving' }, now), /^Moving · 42.3 km\/h/);
  assert.match(truckPositionDescription({ ...position, updated_at: '2026-10-09T11:00:00Z' }, now), /^Last reported: Stationary · 0 km\/h · Outdated/);
  assert.match(truckPositionDescription({ ...position, updated_at: '2026-10-09T11:45:00Z' }, now), /^Stationary/);
  for (const patch of [{ speed_kph: null }, { speed_kph: -1 }, { speed_kph: NaN }, { motion_status: null }, { updated_at: null }, { updated_at: 'bad' }, { updated_at: '2026-10-09T12:01:00Z' }]) {
    assert.match(truckPositionDescription({ ...position, ...patch }, now), /^Movement unknown/);
  }
});
