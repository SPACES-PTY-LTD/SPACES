import test from 'node:test';
import assert from 'node:assert/strict';
import { unfinishedDocumentImport } from '../src/lib/unfinished-document-import.ts';
const upload = (id, status) => ({ import_id: id, filename: `${id}.pdf`, status });
test('offers newest unfinished review, excluding completed and failed uploads', () => {
  assert.deepEqual(unfinishedDocumentImport([upload('done', 'confirmed'), upload('new', 'analyzed'), upload('old', 'analyzed')], null), { id: 'new', filename: 'new.pdf', needsStatusCheck: false });
  assert.equal(unfinishedDocumentImport([upload('done', 'confirmed'), upload('failed', 'failed')], null), null);
  assert.equal(unfinishedDocumentImport([], null), null);
});
test('recovers pending analysis without reuploading and recognizes completed analysis', () => {
  const pending = { id: 'pending', filename: 'pending.pdf' };
  assert.deepEqual(unfinishedDocumentImport([], pending), { ...pending, needsStatusCheck: true });
  assert.deepEqual(unfinishedDocumentImport([upload('pending', 'analyzed')], pending), { ...pending, needsStatusCheck: false });
  assert.equal(unfinishedDocumentImport([upload('pending', 'confirmed')], pending), null);
  assert.equal(unfinishedDocumentImport([upload('pending', 'failed')], pending), null);
});
