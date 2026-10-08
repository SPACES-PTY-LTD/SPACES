import test from 'node:test';
import assert from 'node:assert/strict';
import { documentImportErrorMessage as format } from '../src/lib/document-import-error.ts';

test('shows envelope reason and field details without duplicate messages', () => {
  assert.equal(format({ error: { message: 'Document extraction failed.', details: { file: ['No readable text found.', 'No readable text found.'] } } }, 422), 'Document extraction failed.\nNo readable text found.');
});
test('shows Laravel top-level message and validation errors', () => {
  assert.equal(format({ message: 'The file failed to upload.', errors: { file: ['The file must not exceed 20480 kilobytes.'] } }, 422), 'The file failed to upload.\nThe file must not exceed 20480 kilobytes.');
});
test('details remain useful even when summary is generic or missing', () => {
  assert.equal(format({ error: { message: 'Unable to read the delivery note.', details: { file: 'Unsupported document format.' } } }, 422), 'Unable to read the delivery note.\nUnsupported document format.');
  assert.equal(format({ errors: { file: ['Choose a PDF or image.'] } }, 422), 'Choose a PDF or image.');
});
test('handles string errors and malformed fields without dumping debug metadata', () => {
  assert.equal(format({ error: 'Reading service unavailable.' }, 503), 'Reading service unavailable.');
  assert.equal(format({ message: 'Reading service unavailable.', exception: 'PrivateException', trace: [{ file: '/private/app.php' }], errors: { bad: [null, 42, {}] } }, 503), 'Reading service unavailable.');
  for (const body of [null, {}, [], { error: {} }, { message: 99 }]) assert.equal(format(body, 502), 'Unable to read the delivery note (HTTP 502). Please try again.');
});
