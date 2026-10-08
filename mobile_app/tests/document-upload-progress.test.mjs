import test from 'node:test';
import assert from 'node:assert/strict';
import { observeDocumentUpload } from '../src/lib/document-upload-progress.ts';
import { startDeliveryNoteReading, DELIVERY_NOTE_READING_INTERVAL_MS } from '../src/components/delivery-note-reading-stages.ts';

const request = () => Object.assign(new EventTarget(), { upload: new EventTarget(), readyState: 1 });
const progress = (xhr, values) => xhr.upload.dispatchEvent(Object.assign(new Event('progress'), values));
const headers = xhr => xhr.dispatchEvent(new Event('readystatechange'));
test('dispatched native progress starts rotating messages without handler properties or load', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const xhr = request();
  const messages = [];
  let stop;
  observeDocumentUpload(xhr, () => {
    messages.push(0);
    stop = startDeliveryNoteReading(index => messages.push(index));
  });
  progress(xhr, { lengthComputable: true, loaded: 50, total: 100 });
  assert.deepEqual(messages, []);
  progress(xhr, { lengthComputable: true, loaded: 100, total: 100 });
  assert.deepEqual(messages, [0]);
  t.mock.timers.tick(DELIVERY_NOTE_READING_INTERVAL_MS);
  assert.deepEqual(messages, [0, 1]);
  stop();
});
test('duplicate progress, browser load and headers notify only once', () => {
  const xhr = request();
  let calls = 0;
  observeDocumentUpload(xhr, () => calls++);
  for (let i = 0; i < 2; i++) progress(xhr, { lengthComputable: true, loaded: 101, total: 100 });
  xhr.upload.dispatchEvent(new Event('load'));
  for (const state of [2, 3, 4]) { xhr.readyState = state; headers(xhr); }
  assert.equal(calls, 1);
});
test('headers fall back when progress is unavailable; DONE alone never confirms upload', () => {
  const xhr = request();
  let calls = 0;
  observeDocumentUpload(xhr, () => calls++);
  progress(xhr, { lengthComputable: false, loaded: 100, total: 100 });
  progress(xhr, { lengthComputable: true, loaded: 0, total: 0 });
  xhr.readyState = 4;
  headers(xhr);
  assert.equal(calls, 0);
  xhr.readyState = 2;
  headers(xhr);
  assert.equal(calls, 1);
});
test('browser upload load remains supported without progress', () => {
  const xhr = request();
  let calls = 0;
  observeDocumentUpload(xhr, () => calls++);
  xhr.upload.dispatchEvent(new Event('load'));
  assert.equal(calls, 1);
});
