import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createDeviceRegistrationGate } from '../src/lib/device-registration.ts';
import { driverMessageTarget } from '../src/lib/driver-message-notification.ts';

const conversationId = 'c8d35ab9-9e59-4775-8f84-8a1c956e58dc';
const response = {
  actionIdentifier: 'default',
  notification: { request: { identifier: 'message-1', content: { data: { kind: 'driver_message', conversation_id: conversationId } } } },
};

test('driver payload routes only to Messages with a conversation UUID', () => {
  assert.deepEqual(driverMessageTarget(response.notification.request.content.data), {
    pathname: '/(tabs)/messages', params: { conversation_id: conversationId },
  });
  for (const data of [{}, { kind: 'other', conversation_id: conversationId }, { kind: 'driver_message', conversation_id: 'https://example.com' }, { kind: 'driver_message', conversation_id: ['bad'] }]) {
    assert.equal(driverMessageTarget(data), null);
  }
});

function notificationHarness(initialResponse) {
  const slots = [];
  const effects = [];
  let cursor = 0;
  let listener;
  let clearCount = 0;
  const routes = [];
  const state = { session: null, isHydrating: true, navigation: null, segments: ['(auth)'] };
  const router = { push: route => routes.push(route) };
  const modules = {
    'expo-constants': { default: { appOwnership: 'standalone' } },
    'expo-device': { isDevice: false },
    'expo-notifications': {
      DEFAULT_ACTION_IDENTIFIER: 'default', setNotificationHandler() {},
      getLastNotificationResponse: () => initialResponse,
      clearLastNotificationResponse: () => clearCount++,
      addNotificationResponseReceivedListener: callback => { listener = callback; return { remove() {} }; },
      addPushTokenListener: () => ({ remove() {} }),
    },
    'expo-router': { useRouter: () => router, useRootNavigationState: () => state.navigation, useSegments: () => state.segments },
    react: {
      useState: initial => { const i = cursor++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = value; }]; },
      useRef: initial => { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
      useEffect: (effect, deps) => {
        const i = cursor++;
        if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) {
          slots[i]?.cleanup?.();
          slots[i] = { deps };
          effects.push(() => { slots[i].cleanup = effect(); });
        }
      },
    },
    'react-native': { Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove() {} }) } },
    '@/src/lib/api': { driverApi: {} }, // Tap navigation must work without a network request.
    '@/src/providers/auth-provider': { useAuth: () => state },
    '@/src/lib/driver-message-notification': { driverMessageTarget },
    '@/src/lib/device-registration': { createDeviceRegistrationGate },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/providers/message-notifications.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: false },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; } });
  return {
    state, routes,
    render() { cursor = 0; exports.MessageNotifications(); while (effects.length) effects.shift()(); },
    tap(next) { listener(next); },
    get clearCount() { return clearCount; },
  };
}

test('cold-start tap waits for hydration, login and mounted navigation then opens Messages offline', () => {
  const app = notificationHarness(response);
  app.render(); app.render();
  assert.equal(app.routes.length, 0);
  app.state.session = { token: 'driver-token' };
  app.render();
  assert.equal(app.routes.length, 0);
  app.state.isHydrating = false;
  app.state.navigation = { key: 'root' };
  app.render();
  assert.equal(app.routes.length, 0); // Login redirect must finish first.
  app.state.segments = ['(tabs)'];
  app.render(); app.render();
  assert.equal(app.routes.length, 1);
  assert.equal(app.routes[0].params.conversation_id, conversationId);
  assert.equal(app.clearCount, 1);
  app.tap(response); app.render();
  assert.equal(app.routes.length, 1); // Initial + listener duplicate.
  app.tap({ ...response, notification: { request: { ...response.notification.request, identifier: 'message-2' } } });
  app.render();
  assert.equal(app.routes.length, 2); // Subsequent messages may open the same thread.
});

test('running-app tap opens Messages and ignores unrelated notification actions', () => {
  const app = notificationHarness(null);
  Object.assign(app.state, { session: { token: 'driver-token' }, isHydrating: false, navigation: { key: 'root' }, segments: ['(tabs)'] });
  app.render();
  app.tap({ ...response, actionIdentifier: 'dismiss' }); app.render();
  assert.equal(app.routes.length, 0);
  app.tap(response); app.render();
  assert.equal(app.routes.length, 1);
});
