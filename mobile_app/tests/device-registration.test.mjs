import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceRegistrationGate } from '../src/lib/device-registration.ts';

test('token callback reentry and overlapping triggers share one registration', async () => {
  const register = createDeviceRegistrationGate();
  let reads = 0, posts = 0, nested;
  const get = async () => { reads++; nested = register('session', () => true, get, submit); return 'push'; };
  const submit = async () => { posts++; };
  const first = register('session', () => true, get, submit);
  const second = register('session', () => true, get, submit);
  assert.equal(first, second); await first;
  assert.equal(nested, first); assert.equal(reads, 1); assert.equal(posts, 1);
});
test('unchanged tokens skip posts; rotations, new sessions and daily refresh register', async () => {
  let time = 0, push = 'one', posts = 0;
  const register = createDeviceRegistrationGate(() => time);
  const get = async () => push, submit = async () => { posts++; };
  await register('a', () => true, get, submit);
  time += 60_000; await register('a', () => true, get, submit); assert.equal(posts, 1);
  push = 'two'; time += 60_000; await register('a', () => true, get, submit); assert.equal(posts, 2);
  await register('b', () => true, get, submit); assert.equal(posts, 3);
  time += 24 * 60 * 60_000; await register('a', () => true, get, submit); assert.equal(posts, 4);
});
test('429 honors retry delay and repeated failures back off; later success is cached', async () => {
  let time = 0, posts = 0, failing = true;
  const register = createDeviceRegistrationGate(() => time);
  const get = async () => 'push';
  const submit = async () => { posts++; if (failing) throw Object.assign(new Error('limited'), { retryAfterMs: 180_000 }); };
  await assert.rejects(register('a', () => true, get, submit), /limited/);
  time = 179_999; await register('a', () => true, get, submit); assert.equal(posts, 1);
  time++; await assert.rejects(register('a', () => true, get, submit)); assert.equal(posts, 2);
  time += 180_000; failing = false; await register('a', () => true, get, submit); assert.equal(posts, 3);
  time += 60_000; await register('a', () => true, get, submit); assert.equal(posts, 3);
});
test('network failures back off exponentially and old sessions never submit', async () => {
  let time = 0, posts = 0;
  const register = createDeviceRegistrationGate(() => time);
  const get = async () => 'push', fail = async () => { posts++; throw new Error('offline'); };
  await assert.rejects(register('a', () => true, get, fail));
  time = 60_000; await assert.rejects(register('a', () => true, get, fail));
  time = 179_999; await register('a', () => true, get, fail); assert.equal(posts, 2);
  time++; await assert.rejects(register('a', () => true, get, fail)); assert.equal(posts, 3);
  let active = true, resolve;
  const pending = register('b', () => active, () => new Promise(done => { resolve = done; }), fail);
  await Promise.resolve(); active = false; resolve('push'); await pending; assert.equal(posts, 3);
  await register('c', () => false, get, fail); assert.equal(posts, 3);
});

// Exercise the actual API failure path, including HTTP Retry-After parsing.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function apiHarness(retryAfter) {
  const warnings = [], errors = [], exports = {};
  const modules = {
    'react-native': { Platform: { OS: 'ios' } },
    '../components/dashboard/truck-position-label': { reportedAddress: value => value },
    './document-upload-progress': {}, './document-import-error': {},
    '@/src/config/env': { getEnvironmentConfig: () => ({ apiBaseUrl: 'https://example.test/api/v1' }) },
  };
  const source = ts.transpileModule(readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => modules[name], Date, Error, console: { log() {}, warn: (...args) => warnings.push(args), error: (...args) => errors.push(args) }, fetch: async () => ({ ok: false, status: 429, headers: { get: () => retryAfter }, json: async () => ({ success: false, error: { message: 'Too many attempts.' } }) }) });
  return { api: exports.driverApi, warnings, errors };
}
test('registration 429 is a warning with server cooldown; other API errors stay errors', async () => {
  const app = apiHarness('180');
  await assert.rejects(app.api.registerDevice('session', { platform: 'ios' }), error => error.status === 429 && error.retryAfterMs === 180_000);
  assert.equal(app.warnings.length, 1); assert.equal(app.errors.length, 0);
  await assert.rejects(app.api.locationSharing('session'));
  assert.equal(app.errors.length, 1);
});
test('Retry-After accepts HTTP dates and ignores malformed headers', async () => {
  const future = new Date(Date.now() + 300_000).toUTCString();
  await assert.rejects(apiHarness(future).api.registerDevice('session', { platform: 'ios' }), error => error.retryAfterMs > 290_000 && error.retryAfterMs <= 300_000);
  await assert.rejects(apiHarness('invalid').api.registerDevice('session', { platform: 'ios' }), error => error.retryAfterMs === undefined);
});
