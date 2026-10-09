import test from 'node:test';
import assert from 'node:assert/strict';
import { createSheetHandoff } from '../component/ui/sheet-handoff.ts';
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

for (const source of ['file', 'photo', 'camera']) {
  test(`shipment ${source}: remove both portals before native UI, restore receipt before form`, async () => {
    const events = []; const picker = deferred();
    const receipt = createSheetHandoff(() => events.push('dismiss receipt'), () => events.push('restore receipt'));
    const upload = createSheetHandoff(() => events.push('dismiss upload'), () => events.push('restore upload'));
    const roundTrip = upload.run(() => receipt.run(async () => {
      events.push('source sheet dismissed');
      events.push(source); await picker.promise;
    }));
    assert.deepEqual(events, ['dismiss upload']);
    upload.onDismiss(); await flush();
    assert.deepEqual(events, ['dismiss upload', 'dismiss receipt']);
    assert.equal(receipt.onDismiss(), true, 'temporary dismissal must not close the host');
    await flush();
    assert.deepEqual(events, ['dismiss upload', 'dismiss receipt', 'source sheet dismissed', source]);
    picker.resolve(); await roundTrip;
    assert.deepEqual(events.slice(-2), ['restore receipt', 'restore upload']);
    assert.equal(receipt.onDismiss(), false, 'ordinary dismissal still closes the host');
  });
}

test('shipment source cancellation restores both sheets without native UI', async () => {
  const events = [];
  const receipt = createSheetHandoff(() => {}, () => events.push('receipt'));
  const upload = createSheetHandoff(() => {}, () => events.push('upload'));
  const roundTrip = upload.run(() => receipt.run(async () => {}));
  upload.onDismiss(); await flush(); receipt.onDismiss(); await roundTrip;
  assert.deepEqual(events, ['receipt', 'upload']);
});

test('shipment owner unmount during native selection restores neither sheet', async () => {
  let restored = 0; const picker = deferred();
  const receipt = createSheetHandoff(() => {}, () => restored++);
  const upload = createSheetHandoff(() => {}, () => restored++);
  const roundTrip = upload.run(() => receipt.run(() => picker.promise));
  upload.onDismiss(); await flush(); receipt.onDismiss(); await flush();
  receipt.dispose(); upload.dispose(); picker.resolve(); await roundTrip;
  assert.equal(restored, 0);
});

for (const source of ['photo', 'file', 'camera']) {
  test(`${source}: upload dismissal precedes chooser, chooser completion precedes native picker`, async () => {
    const events = [];
    const chooser = deferred(); const picker = deferred();
    const draft = { run: 'selected-run', file: 'previous.pdf', uploads: 0 };
    const handoff = createSheetHandoff(() => events.push('dismiss upload'), () => events.push('restore upload'));
    const roundTrip = handoff.run(async () => {
      events.push('chooser');
      assert.equal(await chooser.promise, source);
      events.push('native picker');
      const file = await picker.promise;
      if (file) draft.file = file;
    });
    await flush();
    assert.deepEqual(events, ['dismiss upload']);
    assert.equal(handoff.onDismiss(), true);
    await flush();
    assert.equal(handoff.onDismiss(), true, 'duplicate dismissal during handoff must not navigate away');
    assert.deepEqual(events, ['dismiss upload', 'chooser']);
    chooser.resolve(source); await flush();
    assert.deepEqual(events, ['dismiss upload', 'chooser', 'native picker']);
    picker.resolve('chosen.pdf'); await roundTrip;
    assert.deepEqual(events, ['dismiss upload', 'chooser', 'native picker', 'restore upload']);
    assert.deepEqual(draft, { run: 'selected-run', file: 'chosen.pdf', uploads: 0 });
    assert.equal(handoff.onDismiss(), false, 'normal close still belongs to navigation');
  });
}
test('cancelled task restores once without requiring a new selection or reopening the chooser', async () => {
  let restored = 0; let tasks = 0;
  const handoff = createSheetHandoff(() => {}, () => restored++);
  const roundTrip = handoff.run(async () => { tasks++; });
  handoff.onDismiss(); await roundTrip;
  assert.equal(restored, 1); assert.equal(tasks, 1);
  assert.equal(handoff.running, false);
});
test('duplicate taps cannot create another dismissal/picker; next deliberate retry works', async () => {
  let dismissals = 0; let tasks = 0; let restored = 0;
  const picker = deferred();
  const handoff = createSheetHandoff(() => dismissals++, () => restored++);
  const first = handoff.run(async () => { tasks++; await picker.promise; });
  await handoff.run(async () => { tasks++; });
  handoff.onDismiss(); await flush();
  await handoff.run(async () => { tasks++; });
  assert.equal(dismissals, 1); assert.equal(tasks, 1); assert.equal(restored, 0);
  picker.resolve(); await first;
  const retry = handoff.run(async () => { tasks++; });
  handoff.onDismiss(); await retry;
  assert.equal(dismissals, 2); assert.equal(tasks, 2); assert.equal(restored, 2);
});
test('native failure restores the sheet and unlocks retry before propagating error', async () => {
  let restored = 0;
  const handoff = createSheetHandoff(() => {}, () => restored++);
  const result = handoff.run(async () => { throw Error('native unavailable'); });
  handoff.onDismiss();
  await assert.rejects(result, /native unavailable/);
  assert.equal(restored, 1); assert.equal(handoff.running, false);
});
test('navigation/unmount during dismissal aborts picker; during picker never restores stale screen', async () => {
  let tasks = 0; let restored = 0;
  const first = createSheetHandoff(() => {}, () => restored++);
  const waiting = first.run(async () => { tasks++; });
  first.dispose(); await waiting;
  assert.equal(tasks, 0); assert.equal(first.onDismiss(), false);
  const picker = deferred();
  const second = createSheetHandoff(() => {}, () => restored++);
  const picking = second.run(async () => { tasks++; await picker.promise; });
  second.onDismiss(); await flush(); second.dispose(); picker.resolve(); await picking;
  assert.equal(tasks, 1); assert.equal(restored, 0); assert.equal(second.active, false);
});
test('camera confirmation/retake stays suspended until entire task completes', async () => {
  const confirmation = deferred(); const retake = deferred();
  let restored = 0;
  const handoff = createSheetHandoff(() => {}, () => restored++);
  const task = handoff.run(async () => { await confirmation.promise; await retake.promise; });
  handoff.onDismiss(); await flush(); confirmation.resolve(); await flush();
  assert.equal(restored, 0); assert.equal(handoff.running, true);
  retake.resolve(); await task; assert.equal(restored, 1);
});
