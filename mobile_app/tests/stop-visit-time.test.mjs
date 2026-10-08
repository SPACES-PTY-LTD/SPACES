import test from 'node:test';
import assert from 'node:assert/strict';
import { stopVisitDuration } from '../src/components/dashboard/stop-visit-time.ts';
test('formats seconds, minutes and hours from recorded entry/exit', () => {
  assert.equal(stopVisitDuration('2026-10-08T10:00:00Z', '2026-10-08T10:00:00Z'), '0 sec');
  assert.equal(stopVisitDuration('2026-10-08T10:00:00Z', '2026-10-08T10:00:42Z'), '42 sec');
  assert.equal(stopVisitDuration('2026-10-08T10:00:00Z', '2026-10-08T11:04:00Z'), '1 hr 4 min');
  assert.equal(stopVisitDuration('2026-10-08T10:00:00Z', '2026-10-08T11:00:00Z'), '1 hr');
  assert.equal(stopVisitDuration('2026-10-08T10:05:59Z', '2026-10-08T10:07:47Z'), '1 min 48 sec');
});
test('uses elapsed timestamps across midnight, offsets and multiple days', () => {
  assert.equal(stopVisitDuration('2026-10-08T23:50:00+02:00', '2026-10-08T22:10:00Z'), '20 min');
  assert.equal(stopVisitDuration('2026-10-08T10:00:00Z', '2026-10-10T12:05:00Z'), '2 days 2 hr 5 min');
});
test('never invents duration for missing, invalid or reversed event evidence', () => {
  for (const pair of [[null, null], ['2026-10-08T10:00:00Z', null], [null, '2026-10-08T10:00:00Z'], ['invalid', 'invalid'], ['2026-10-08T11:00:00Z', '2026-10-08T10:00:00Z']]) assert.equal(stopVisitDuration(...pair), null);
});
