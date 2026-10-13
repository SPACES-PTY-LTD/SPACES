import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness(logout) {
  const slots = []; let cursor = 0, value, clears = 0;
  const React = {
    createContext: () => ({ Provider: 'Provider' }), useContext: () => value, useEffect() {},
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = next; }]; },
  };
  const modules = {
    react: React, 'react/jsx-runtime': { jsx: (_, props) => { value = props.value; return null; } },
    '@/src/config/env': { getEnvironmentConfig: () => ({}) },
    '@/src/lib/api': { authApi: { logout, login: async () => ({ token: 'session', refresh_token: 'refresh', user: { role: 'driver' } }) } },
    '@/src/lib/auth-storage': { writeSession: async () => {}, clearSession: async () => { clears++; } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/providers/auth-provider.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: key => modules[key] });
  const render = () => { cursor = 0; exports.AuthProvider({ children: null }); }; render();
  return { render, get value() { return value; }, get clears() { return clears; }, async login() { await value.signIn({}); render(); } };
}
test('logout waits for server device removal before clearing local session', async () => {
  let done; const app = harness(() => new Promise(resolve => { done = resolve; })); await app.login();
  const pending = app.value.signOut(); app.render();
  assert.equal(app.value.session.token, 'session'); assert.equal(app.clears, 0);
  done(); await pending; app.render(); assert.equal(app.value.session, null); assert.equal(app.clears, 1);
});
test('offline logout retains session and propagates error for retry', async () => {
  let offline = true; const app = harness(async () => { if (offline) throw new Error('offline'); }); await app.login();
  await assert.rejects(app.value.signOut(), /offline/); app.render();
  assert.equal(app.value.session.token, 'session'); assert.equal(app.clears, 0);
  offline = false; await app.value.signOut(); app.render(); assert.equal(app.value.session, null); assert.equal(app.clears, 1);
});
