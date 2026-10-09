import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness({ os = 'ios', ownership = 'standalone', granted = false, canAskAgain = true, allow = true, fail = false } = {}) {
  const slots = [], effects = [], calls = [];
  let cursor = 0, focus, cleanup, foreground, requested = 0, opened = 0, registered = 0;
  const permission = () => ({ granted, canAskAgain });
  const modules = {
    'expo-constants': { default: { appOwnership: ownership } },
    'expo-notifications': { AndroidImportance: { HIGH: 4 }, getPermissionsAsync: async () => permission(), requestPermissionsAsync: async () => { requested++; calls.push('request'); if (fail) throw Error('failed'); granted = allow; return permission(); }, setNotificationChannelAsync: async () => { calls.push('channel'); } },
    react: {
      useState: initial => { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = value; }]; },
      useRef: initial => { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
      useCallback: cb => cb, useEffect: cb => effects.push(cb),
    },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { useFocusEffect: cb => { focus = cb; } },
    'react-native': { Platform: { OS: os }, Switch: 'Switch', View: 'View', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', Linking: { openSettings: async () => { opened++; } }, AppState: { addEventListener: (_, cb) => { foreground = cb; return { remove() {} }; } } },
    '@/component/ui/Text': { Text: 'Text' },
    '@/src/components/AccountUI': { AccountPage: 'AccountPage', accountStyles: {}, useAccountColors: () => ({}) },
    '@/src/providers/auth-provider': { useAuth: () => ({ session: { token: 'token' } }) },
    '@/src/providers/message-notifications': { registerMessageNotificationDevice: async (_, current) => { if (current()) registered++; } },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../app/account/notifications.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: false, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; } });
  function render() { cursor = 0; const tree = exports.default(); while (effects.length) effects.shift()(); return tree; }
  function find(tree) { if (!tree || typeof tree !== 'object') return null; if (tree.type === 'Switch') return tree; return [tree.props?.children].flat(Infinity).map(find).find(Boolean); }
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  return { async mount() { render(); cleanup = focus(); await flush(); }, switch() { return find(render()).props; }, text() { return JSON.stringify(render()); }, async toggle(value) { this.switch().onValueChange(value); await flush(); }, async resume(value) { granted = value; foreground('active'); await flush(); }, unmount() { cleanup(); }, flush, calls, get requested() { return requested; }, get opened() { return opened; }, get registered() { return registered; } };
}

test('enable requests permission and registers immediately; Android creates a channel first', async () => {
  for (const os of ['ios', 'android']) {
    const app = harness({ os }); await app.mount(); assert.equal(app.switch().value, false);
    await app.toggle(true); assert.equal(app.requested, 1); assert.equal(app.registered, 1); assert.equal(app.switch().value, true);
    assert.deepEqual(app.calls, os === 'android' ? ['channel', 'request'] : ['request']);
  }
});
test('denied permission stays off and blocked permission opens settings', async () => {
  const denied = harness({ allow: false }); await denied.mount(); await denied.toggle(true);
  assert.equal(denied.switch().value, false); assert.equal(denied.registered, 0); assert.match(denied.text(), /Notifications are disabled/);
  const blocked = harness({ canAskAgain: false }); await blocked.mount(); await blocked.toggle(true);
  assert.equal(blocked.requested, 0); assert.equal(blocked.opened, 1);
});
test('disable opens settings and updates the switch on foreground return', async () => {
  const app = harness({ granted: true }); await app.mount(); await app.toggle(false);
  assert.equal(app.opened, 1); assert.equal(app.switch().value, true);
  await app.resume(false); assert.equal(app.switch().value, false);
});
test('web and Expo Go keep the switch visible and disabled', async () => {
  for (const options of [{ os: 'web' }, { ownership: 'expo' }]) {
    const app = harness(options); await app.mount(); assert.equal(app.switch().disabled, true);
    await app.toggle(true); assert.equal(app.requested, 0); assert.equal(app.opened, 0);
  }
});
test('request failures show an error and unlock the switch', async () => {
  const app = harness({ fail: true }); await app.mount(); await app.toggle(true);
  assert.equal(app.switch().disabled, false); assert.match(app.text(), /Unable to change notification settings/);
});
test('rapid toggles request once and leaving the screen prevents late registration', async () => {
  const app = harness(); await app.mount(); app.switch().onValueChange(true); app.switch().onValueChange(true);
  await app.flush(); assert.equal(app.requested, 1);
  const leaving = harness(); await leaving.mount(); leaving.switch().onValueChange(true); leaving.unmount();
  await leaving.flush(); assert.equal(leaving.requested, 0); assert.equal(leaving.registered, 0);
});
