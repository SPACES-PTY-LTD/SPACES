import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const operation = status => ({ job_id: 'job-1', status, requested_types: ['shipments'], created_at: '2026-11-16T12:00:00Z', started_at: null, finished_at: null, result: null, error_message: status === 'failed' ? 'Database is busy. Try again.' : null });
const envelope = data => ({ success: true, data });
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness(initialStatus = null) {
  const slots = [], timers = new Map(), effects = [], cleanups = [];
  let cursor = 0, tree, nextStatus = envelope(initialStatus), nextPost = envelope(operation('queued')), lastPayload, timerId = 0;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(effect) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push(effect); } },
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/settings/delete-data-manager.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports, AbortController, Date,
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'sonner') return { toast: { error() {}, success() {} } };
      if (name === '@/lib/api/client') return { isApiErrorResponse: r => r?.error === true };
      if (name === '@/lib/api/delete-data') return {
        purgeDataTypes: ['shipments'],
        getPurgeStatus: async () => nextStatus,
        purgeMerchantData: async (_merchant, payload) => { lastPayload = payload; return nextPost; },
      };
      return new Proxy({}, { get: (_target, key) => key });
    },
  });
  const wrapper = exports.DeleteDataManager({ merchantId: 'merchant-1', accessToken: 'token' });
  const nodes = n => Array.isArray(n) ? n.flatMap(nodes) : n && typeof n === 'object' ? [n, ...nodes(n.props?.children)] : [];
  const text = n => Array.isArray(n) ? n.map(text).join(' ') : n && typeof n === 'object' ? text(n.props?.children) : String(n ?? '');
  function render() { cursor = 0; tree = wrapper.type(wrapper.props); }
  function find(predicate) { const node = nodes(tree).find(predicate); assert.ok(node); return node; }
  render();
  for (const effect of effects) cleanups.push(effect());
  return {
    render, find, get text() { return text(tree).replace(/\s+/g, ' '); }, get payload() { return lastPayload; },
    get disabled() { return find(n => n.type === 'Button' && text(n).includes('Delete selected')).props.disabled; },
    setStatus(value) { nextStatus = value; }, setPost(value) { nextPost = value; },
    async tick() { const [id, callback] = timers.entries().next().value; timers.delete(id); await callback(); render(); },
    async settle() { await flush(); render(); },
    prepare() {
      find(n => n.type === 'input').props.onChange();
      find(n => n.type === 'Input').props.onChange({ target: { value: ' password ' } });
      render();
    },
    confirm() { return find(n => n.type === 'Button' && text(n).includes('Confirm delete')).props.onClick(); },
    unmount() { for (const cleanup of cleanups) cleanup?.(); },
    get timers() { return timers.size; },
    merchantKey(id) { return exports.DeleteDataManager({ merchantId: id }).key; },
  };
}

test('restores persisted operation on mount and monitors terminal success', async () => {
  const app = harness(operation('queued'));
  assert.equal(app.disabled, true);
  await app.settle();
  assert.match(app.text, /Deletion queued/);
  assert.equal(app.disabled, true);
  app.setStatus(envelope(operation('running'))); await app.tick();
  assert.match(app.text, /Deletion running/);
  app.setStatus(envelope(operation('completed'))); await app.tick();
  assert.match(app.text, /Database deletion completed/);
  assert.match(app.text, /cleanup runs separately/);
  assert.equal(app.disabled, false);
  assert.notEqual(app.merchantKey('merchant-1'), app.merchantKey('merchant-2'));
  app.unmount(); assert.equal(app.timers, 0);
});

test('monitoring failure does not imply deletion failed and blocks resubmission until recovered', async () => {
  const app = harness(); await app.settle();
  app.setStatus({ error: true, message: 'network failed' }); await app.tick();
  assert.match(app.text, /Deletion may still be running/);
  assert.equal(app.disabled, true);
  app.setStatus(envelope(operation('failed'))); await app.tick();
  assert.match(app.text, /Database is busy/);
  assert.equal(app.disabled, false);
  app.unmount();
});

test('queues deletion without trimming password and ignores a stale pre-submit poll', async () => {
  const app = harness(); await app.settle(); app.prepare();
  let resolve;
  app.setStatus(new Promise(r => { resolve = r; }));
  const pendingPoll = app.tick();
  await app.confirm(); app.render();
  assert.equal(app.payload.password, ' password ');
  assert.match(app.text, /Deletion queued/);
  resolve(envelope(null)); await pendingPoll;
  assert.match(app.text, /Deletion queued/);
  assert.equal(app.disabled, true);
  app.unmount();
});
