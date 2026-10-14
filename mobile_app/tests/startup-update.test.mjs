import test from 'node:test';
import assert from 'node:assert/strict';
import { startStartupUpdate } from '../src/lib/startup-update.ts';
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function setup(overrides = {}, timeout = 1000) {
  const calls = [];
  const client = {
    checkForUpdateAsync: async () => { calls.push('check'); return { isAvailable: true }; },
    fetchUpdateAsync: async () => { calls.push('fetch'); return { isNew: true }; },
    reloadAsync: async () => { calls.push('reload'); },
    ...overrides,
  };
  return { calls, gate: startStartupUpdate(client, () => calls.push('ready'), timeout) };
}
test('downloads and reloads before allowing driver screens to mount', async () => {
  const { calls, gate } = setup(); await flush();
  assert.deepEqual(calls, ['check', 'fetch', 'reload']); gate.dispose();
});
test('no update and failed check, download or reload open normally once', async () => {
  for (const method of ['none', 'checkForUpdateAsync', 'fetchUpdateAsync', 'reloadAsync']) {
    const override = method === 'none' ? { checkForUpdateAsync: async () => ({ isAvailable: false }) } : { [method]: async () => { throw Error('offline'); } };
    const { calls, gate } = setup(override); await flush(); gate.skip();
    assert.equal(calls.filter(x => x === 'ready').length, 1); gate.dispose();
  }
});
test('timeout, background skip and unmount prevent a late download from reloading', async () => {
  for (const cancel of ['timeout', 'skip', 'dispose']) {
    let complete;
    const { calls, gate } = setup({ fetchUpdateAsync: () => new Promise(resolve => { complete = resolve; }) }, cancel === 'timeout' ? 5 : 1000);
    await flush();
    if (cancel === 'timeout') await new Promise(resolve => setTimeout(resolve, 15));
    else gate[cancel]();
    complete({ isNew: true }); await flush();
    assert.equal(calls.includes('reload'), false);
    assert.equal(calls.includes('ready'), cancel !== 'dispose'); gate.dispose();
  }
});
test('server rollback directives are fetched and applied', async () => {
  const { calls, gate } = setup({ checkForUpdateAsync: async () => ({ isAvailable: false, isRollBackToEmbedded: true }), fetchUpdateAsync: async () => ({ isNew: false, isRollBackToEmbedded: true }) });
  await flush(); assert.deepEqual(calls, ['reload']); gate.dispose();
});
