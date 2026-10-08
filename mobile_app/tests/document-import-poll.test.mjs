import test from 'node:test';
import assert from 'node:assert/strict';
import { pollDocumentImport as mobilePoll } from '../src/lib/document-import-poll.ts';
import { pollDocumentImport as websitePoll } from '../../website/src/lib/delivery-note-analysis-poll.ts';
for (const [client, pollDocumentImport] of [['mobile', mobilePoll], ['website', websitePoll]]) {

const controller = () => new AbortController();
const immediate = async () => {};
test(`${client}: polls queued and processing to completion without reuploading`, async () => {
  const states = ['queued', 'processing', 'analyzed'];
  const delays = [];
  let received = 0;
  const result = await pollDocumentImport(async () => ({ status: states.shift() }), controller().signal, () => received++, async ms => delays.push(ms));
  assert.equal(result.status, 'analyzed');
  assert.equal(received, 3);
  assert.deepEqual(delays, [3200, 3200]);
});
test(`${client}: recovers lost acknowledgement, brief 404, gateway and network failures`, async () => {
  const responses = [Object.assign(new Error('Not created yet'), { status: 404 }), Object.assign(new Error('Gateway'), { status: 504 }), new Error('Offline'), { status: 'analyzed' }];
  const result = await pollDocumentImport(async () => { const response = responses.shift(); if (response instanceof Error) throw response; return response; }, controller().signal, () => {}, immediate);
  assert.equal(result.status, 'analyzed');
});
test(`${client}: returns processing failure reason and stops on authorization failure`, async () => {
  const result = await pollDocumentImport(async () => ({ status: 'failed', failure_message: 'Unreadable PDF' }), controller().signal, () => {}, immediate);
  assert.equal(result.failure_message, 'Unreadable PDF');
  await assert.rejects(pollDocumentImport(async () => { throw Object.assign(new Error('Sign in again'), { status: 401 }); }, controller().signal, () => {}, immediate), /Sign in again/);
});
test(`${client}: bounds checks and preserves a check-again outcome for slow jobs`, async () => {
  let checks = 0;
  await assert.rejects(pollDocumentImport(async () => { checks++; return { status: 'queued' }; }, controller().signal, () => {}, immediate), /Check processing status/);
  assert.equal(checks, 38);
});
test(`${client}: unmount abort cancels fetch and prevents result callbacks`, async () => {
  const abort = controller();
  let received = 0;
  await assert.rejects(pollDocumentImport(async signal => { abort.abort(); assert.equal(signal.aborted, true); return { status: 'analyzed' }; }, abort.signal, () => received++, immediate), /cancelled/);
  assert.equal(received, 0);
});

}
