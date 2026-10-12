import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  const slots = [], effects = [], requests = [], listeners = new Map(), timers = new Set();
  let cursor = 0, refreshes = 0;
  const router = { refresh: () => refreshes++ };
  const props = { token: 'token', runId: 'run', request: { request_id: 'old', status: 'rejected' }, enabled: true };
  const document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const modules = {
    react: {
      useEffect(fn, deps) {
        const i = cursor++;
        if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) {
          slots[i]?.cleanup?.(); slots[i] = { deps };
          effects.push(() => { slots[i].cleanup = fn(); });
        }
      },
    },
    'next/navigation': { useRouter: () => router },
    '@/lib/api/runs': { getRun: (runId, token) => new Promise((resolve, reject) => requests.push({ token, runId, resolve, reject })) },
    '@/lib/api/client': { isApiErrorResponse: value => !!value.error },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/components/runs/use-run-end-request-refresh.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => modules[name], document, window: document, URLSearchParams,
    setInterval: fn => { timers.add(fn); return fn; }, clearInterval: fn => timers.delete(fn) });
  function render() { cursor = 0; exports.useRunEndRequestRefresh(props.runId, props.request, props.token, props.enabled); while (effects.length) effects.shift()(); }
  return { props, document, requests, listeners, timers, render, get refreshes() { return refreshes; },
    async flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); render(); },
    resolve(index, request = props.request, status = "in_progress") { requests[index].resolve({ status, end_request: request }); },
    emit(name) { listeners.get(name)?.(); }, poll() { timers.forEach(fn => fn()); },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
}

test('reopens rejected and resolved cards when a new pending request arrives', async () => {
  for (const status of ['rejected', 'resolved']) {
    const app = harness(); app.props.request.status = status; app.render();
    app.resolve(0); await app.flush(); assert.equal(app.refreshes, 0);
    app.poll(); app.resolve(1, { request_id: 'new', status: 'pending' }); await app.flush();
    assert.equal(app.refreshes, 1);
    app.poll(); assert.equal(app.requests.length, 2);
    app.props.request = { request_id: 'new', status: 'pending' }; app.render();
    app.resolve(2); await app.flush(); assert.equal(app.refreshes, 1);
    app.unmount(); assert.equal(app.listeners.size, 0); assert.equal(app.timers.size, 0);
  }
});

test('checks on focus, skips hidden and overlapping requests, retries failures', async () => {
  const app = harness(); app.render(); app.poll(); assert.equal(app.requests.length, 1);
  app.requests[0].reject(new Error('offline')); await app.flush();
  app.document.hidden = true; app.poll(); assert.equal(app.requests.length, 1);
  app.document.hidden = false; app.emit('focus');
  app.requests[1].resolve({ error: true }); await app.flush(); assert.equal(app.refreshes, 0);
  app.emit('visibilitychange'); app.resolve(2, app.props.request, 'completed'); await app.flush();
  assert.equal(app.refreshes, 1);
});

test('ignores late responses after a run or session change and stops when disabled', async () => {
  const app = harness(); app.render();
  app.props.runId = 'other-run'; app.props.token = 'other-token'; app.render();
  app.resolve(0, { request_id: 'stale', status: 'pending' }); await app.flush(); assert.equal(app.refreshes, 0);
  assert.equal(app.requests[1].runId, 'other-run'); assert.equal(app.requests[1].token, 'other-token');
  app.props.enabled = false; app.render();
  app.resolve(1, { request_id: 'late', status: 'pending' }); await app.flush(); assert.equal(app.refreshes, 0);
  app.poll(); assert.equal(app.requests.length, 2); assert.equal(app.listeners.size, 0);
});
