import test from 'node:test';
import assert from 'node:assert/strict';
import { DELIVERY_NOTE_READING_INTERVAL_MS, DELIVERY_NOTE_READING_STAGES, DELIVERY_NOTE_WRAPPING_UP, startDeliveryNoteReading } from '../src/components/delivery-note-reading-stages.ts';

test('advances through 15 reading messages then holds wrapping up without looping', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const messages = [DELIVERY_NOTE_READING_STAGES[0]];
  const stop = startDeliveryNoteReading(index => messages.push(DELIVERY_NOTE_READING_STAGES[index] ?? DELIVERY_NOTE_WRAPPING_UP));
  t.mock.timers.tick(DELIVERY_NOTE_READING_INTERVAL_MS - 1);
  assert.equal(messages.length, 1);
  t.mock.timers.tick(1);
  assert.equal(messages[1], DELIVERY_NOTE_READING_STAGES[1]);
  for (let index = 2; index <= 15; index += 1) t.mock.timers.tick(DELIVERY_NOTE_READING_INTERVAL_MS);
  assert.equal(messages.length, 16);
  assert.equal(new Set(messages.slice(0, 15)).size, 15);
  assert.equal(messages.at(-1), 'Wrapping up…');
  t.mock.timers.tick(120000);
  assert.equal(messages.length, 16);
  stop();
});

test('a fast result stops scheduled updates before the next message', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let updates = 0;
  const stop = startDeliveryNoteReading(() => updates += 1);
  stop();
  t.mock.timers.tick(120000);
  assert.equal(updates, 0);
});

test('failure/unmount cancels updates and a retry starts at the first stage again', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const first = [];
  const stop = startDeliveryNoteReading(index => first.push(index));
  t.mock.timers.tick(DELIVERY_NOTE_READING_INTERVAL_MS);
  stop();
  t.mock.timers.tick(120000);
  assert.deepEqual(first, [1]);
  const retry = [];
  const stopRetry = startDeliveryNoteReading(index => retry.push(index));
  t.mock.timers.tick(DELIVERY_NOTE_READING_INTERVAL_MS);
  assert.deepEqual(retry, [1]);
  stopRetry();
});
