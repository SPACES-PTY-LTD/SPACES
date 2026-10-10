import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(store = new Map()) {
  let now = 100_000;
  const exports = {};
  const storage = { getItem: async k => store.get(k) ?? null, setItem: async (k, v) => store.set(k, v) };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/phone-location-report.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: () => ({ __esModule: true, default: storage }), Date: { now: () => now }, Number, Set,
  });
  return { run: exports.withPhoneLocationReport, advance: ms => { now += ms; }, store };
}

test('foreground and background share the interval and concurrent sends are skipped', async () => {
  const app = harness(); let sends = 0, finish;
  const foreground = app.run('driver', async () => { sends++; await new Promise(r => { finish = r; }); return 'sent'; });
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(await app.run('driver', async () => { sends++; }), null);
  finish(); assert.equal(await foreground, 'sent');
  assert.equal(await app.run('driver', async () => { sends++; }), null);
  app.advance(30_000); await app.run('driver', async () => { sends++; });
  assert.equal(sends, 2);
});

test('Retry-After blocks both senders through a task restart and expires exactly', async () => {
  const app = harness(); let sends = 0;
  await assert.rejects(app.run('driver', async () => { throw { status: 429, retryAfterMs: 90_000 }; }));
  const restarted = harness(app.store);
  restarted.advance(89_999);
  assert.equal(await restarted.run('driver', async () => { sends++; }), null);
  restarted.advance(1); await restarted.run('driver', async () => { sends++; });
  assert.equal(sends, 1);
});

test('missing or invalid retry delay falls back to one minute and drivers are isolated', async () => {
  for (const retryAfterMs of [undefined, NaN, Infinity]) {
    const app = harness();
    await assert.rejects(app.run('first', async () => { throw { status: 429, retryAfterMs }; }));
    assert.equal(await app.run('second', async () => 'other driver'), 'other driver');
    app.advance(59_999); assert.equal(await app.run('first', async () => 'too early'), null);
    app.advance(1); assert.equal(await app.run('first', async () => 'retry'), 'retry');
  }
});

test('transient failures keep the normal interval and release the in-flight gate', async () => {
  const app = harness();
  await assert.rejects(app.run('driver', async () => { throw { status: 500 }; }));
  app.advance(30_000); assert.equal(await app.run('driver', async () => 'retry'), 'retry');
});
