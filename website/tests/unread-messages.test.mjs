import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  const slots = [], effects = [], requests = [], listeners = new Map(), timers = new Set();
  let cursor = 0, count;
  const props = { token: 'token', merchant: 'merchant', enabled: true };
  const document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const modules = {
    react: {
      useState(initial) {
        const i = cursor++;
        slots[i] ??= { value: initial };
        return [slots[i].value, value => { slots[i].value = value; }];
      },
      useEffect(fn, deps) {
        const i = cursor++;
        if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) {
          slots[i]?.cleanup?.(); slots[i] = { deps };
          effects.push(() => { slots[i].cleanup = fn(); });
        }
      },
    },
    '@/lib/api/conversations': { conversationRequest: (token, path) => new Promise((resolve, reject) => requests.push({ token, path, resolve, reject })) },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/components/messages/use-unread-messages.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => modules[name], document, window: document, URLSearchParams,
    setInterval: fn => { timers.add(fn); return fn; }, clearInterval: fn => timers.delete(fn) });
  function render() { cursor = 0; count = exports.useUnreadMessages(props.token, props.merchant, props.enabled); while (effects.length) effects.shift()(); }
  return { props, document, requests, listeners, timers, render, get count() { return count; },
    async flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); render(); },
    resolve(index, count) { requests[index].resolve({ data: { unread_count: count } }); },
    emit(name) { listeners.get(name)?.(); }, poll() { timers.forEach(fn => fn()); },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
}

test('refreshes after reads and focus, skips hidden polling, preserves count on failure', async () => {
  const app = harness(); app.render(); assert.equal(app.count, 0);
  assert.equal(app.requests[0].path, '/unread?merchant_id=merchant');
  app.resolve(0, 4); await app.flush(); assert.equal(app.count, 4);
  app.emit('messages-read'); app.resolve(1, 0); await app.flush(); assert.equal(app.count, 0);
  app.emit('focus'); app.resolve(2, 7); await app.flush();
  app.document.hidden = true; app.poll(); assert.equal(app.requests.length, 3);
  app.document.hidden = false; app.emit('visibilitychange');
  app.requests[3].reject(new Error('Offline')); await app.flush(); assert.equal(app.count, 7);
  app.unmount(); assert.equal(app.listeners.size, 0); assert.equal(app.timers.size, 0);
});

test('ignores stale merchant and token responses and disables the badge', async () => {
  const app = harness(); app.render();
  app.props.merchant = 'other'; app.render();
  app.resolve(0, 88); await app.flush(); assert.equal(app.count, 0);
  app.resolve(1, 3); await app.flush(); assert.equal(app.count, 3);
  app.emit('focus'); app.props.token = 'new-token'; app.render();
  app.resolve(2, 99); await app.flush(); assert.equal(app.count, 0);
  app.resolve(3, 2); await app.flush(); assert.equal(app.count, 2);
  app.props.enabled = false; app.render(); assert.equal(app.count, 0); assert.equal(app.listeners.size, 0);
});

test('queues a read refresh while an earlier count is in flight', async () => {
  const app = harness(); app.render(); app.emit('messages-read');
  assert.equal(app.requests.length, 1);
  app.resolve(0, 6); await app.flush(); assert.equal(app.requests.length, 2);
  app.resolve(1, 0); await app.flush(); assert.equal(app.count, 0);
  app.emit('focus'); app.unmount(); app.resolve(2, 9); await app.flush(); assert.equal(app.count, 0);
});
