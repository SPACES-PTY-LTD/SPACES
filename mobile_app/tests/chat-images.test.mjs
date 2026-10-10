import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const helpers = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/chat-images.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: helpers, Math });
const { isChatImage, chatImages, photoSwipeDirection, photoPanOffset } = helpers;
test('image detection respects MIME types, generic filenames and record references', () => {
  assert.ok(isChatImage({ type: 'file', mime_type: 'image/jpeg', filename: 'photo' }));
  assert.ok(isChatImage({ type: 'file', mime_type: 'application/octet-stream', filename: 'PHOTO.HEIC' }));
  assert.equal(isChatImage({ type: 'file', mime_type: 'application/pdf', filename: 'photo.jpg' }), false);
  assert.equal(isChatImage({ type: 'shipment', mime_type: 'image/jpeg' }), false);
  assert.equal(isChatImage({ type: 'file', reference: {}, mime_type: 'image/png' }), false);
});
test('gallery follows message/attachment order and excludes documents', () => {
  const a = { attachment_id: 'a', mime_type: 'image/jpeg' }, b = { attachment_id: 'b', filename: 'b.png' };
  assert.deepEqual(Array.from(chatImages([{ attachments: [a, { mime_type: 'application/pdf' }] }, { attachments: [b] }])), [a, b]);
});
test('photo swipes require a deliberate distance or velocity and choose the correct direction', () => {
  assert.equal(photoSwipeDirection(12, 100), 0);
  assert.equal(photoSwipeDirection(-60, 0), 1);
  assert.equal(photoSwipeDirection(60, 0), -1);
  assert.equal(photoSwipeDirection(-12, -700), 1);
});
test('zoom panning remains bounded and resets to center at normal scale', () => {
  assert.equal(photoPanOffset(300, 200, 2), 100);
  assert.equal(photoPanOffset(-300, 200, 2), -100);
  assert.equal(photoPanOffset(300, 200, 1), 0);
});
