import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const message = id => ({ message_id: id, created_at: `2026-10-09T10:00:0${id}Z`, attachments: [], body: `Message ${id}` });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function harness() {
  const slots = [], effects = [], timers = new Map();
  let cursor = 0, tree, focused = true, listener, next = deferred(), opens = 0;
  const state = { session: { token: 'token', user: { user_id: 'driver' } } };
  const refreshUnread = async () => {};
  const chat = { conversation_id: 'chat', type: 'driver', status: 'active' };
  function effect(callback, deps) {
    const i = cursor++;
    if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) {
      slots[i]?.cleanup?.(); slots[i] = { deps };
      effects.push(() => { slots[i].cleanup = callback(); });
    }
  }
  const modules = {
    react: {
      useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
      useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
      useCallback(callback, deps) { const i = cursor++; if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) slots[i] = { deps, callback }; return slots[i].callback; },
      useEffect: effect,
    },
    'react/jsx-runtime': { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) },
    'expo-router': { useLocalSearchParams: () => ({}), useFocusEffect: callback => effect(() => focused ? callback() : undefined, [callback, focused]) },
    'react-native': { ...Object.fromEntries(['ActivityIndicator', 'FlatList', 'KeyboardAvoidingView', 'Pressable', 'TextInput', 'View'].map(key => [key, key])), Platform: { OS: 'ios' }, StyleSheet: { create: styles => styles }, AppState: { currentState: 'active', addEventListener: (_, callback) => { listener = callback; return { remove() {} }; } } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'light' }) },
    '@/src/providers/auth-provider': { useAuth: () => state },
    '@/src/providers/unread-messages-provider': { useUnreadMessages: () => ({ refresh: refreshUnread }) },
    '@/src/providers/message-notifications': { setVisibleDriverChat() {} },
    '@/component/ui/Text': { Text: 'Text' }, '@/component/ui/PageHeader': { PageHeader: 'PageHeader' },
    '@/component/ui/ActionSheet': { ActionSheet: 'ActionSheet' },
    '@/src/lib/api': { chatApi: { openDriver: async () => { opens++; return chat; }, show: async () => chat, messages: async () => await next.promise, read: async () => {} } },
    'expo-image': { Image: 'Image' }, '@expo/vector-icons': { Feather: 'Feather' },
    'expo-document-picker': {}, 'expo-image-picker': {}, 'expo-crypto': {}, '@/src/components/ChatReferenceSheet': {},
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../app/(tabs)/messages.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { exports, require: name => { if (name.endsWith('.svg')) return name; assert.ok(name in modules, name); return modules[name]; }, Error, Map, Date, setTimeout() {}, setInterval: callback => { timers.set(callback, callback); return callback; }, clearInterval: id => timers.delete(id) });
  function render() { cursor = 0; const child = exports.default(); tree = child.type(child.props); while (effects.length) effects.shift()(); }
  function nodes(type) {
    const result = [];
    function visit(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit); if (node.type === type) result.push(node); visit(node.props?.children); }
    visit(tree); return result;
  }
  return {
    render, nodes, async flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); render(); },
    resolve(data, before = null) { next.resolve({ data, meta: { next_before: before } }); },
    defer() { next = deferred(); }, fail() { next.reject(new Error('Offline')); },
    poll() { timers.forEach(callback => callback()); render(); },
    focus(value) { focused = value; render(); }, foreground() { listener('active'); render(); },
    newSessionObject() { state.session = { ...state.session, user: { ...state.session.user } }; render(); },
    get opens() { return opens; }, unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
function headerSpinner(app) { return app.nodes('PageHeader')[0].props.action; }

test('initial loading becomes a small header spinner while polling preserves messages and draft', async () => {
  const app = harness(); app.render(); await app.flush();
  assert.equal(app.nodes('FlatList').length, 0); assert.equal(headerSpinner(app), undefined);
  app.resolve([message('1')], 'older-cursor'); await app.flush();
  app.nodes('TextInput')[0].props.onChangeText('Unsent draft'); app.render();
  app.defer(); app.poll(); await app.flush();
  assert.equal(headerSpinner(app).props.size, 'small'); assert.equal(app.nodes('FlatList')[0].props.data[0].message_id, '1');
  assert.equal(app.nodes('TextInput')[0].props.value, 'Unsent draft'); assert.equal(app.nodes('TextInput')[0].props.editable, true);
  app.resolve([message('1'), message('2')]); await app.flush();
  assert.equal(headerSpinner(app), undefined); assert.equal(app.nodes('FlatList')[0].props.data.length, 2);
  assert.ok(app.nodes('FlatList')[0].props.ListHeaderComponent); app.unmount();
});
test('tab return and retry retain messages and older-page cursor', async () => {
  const app = harness(); app.render(); app.resolve([message('1')], 'older-cursor'); await app.flush();
  app.focus(false); app.defer(); app.focus(true); await app.flush();
  assert.equal(app.opens, 1); assert.equal(app.nodes('FlatList')[0].props.data.length, 1); assert.ok(headerSpinner(app));
  app.fail(); await app.flush();
  assert.equal(headerSpinner(app), undefined); assert.equal(app.nodes('FlatList')[0].props.data.length, 1);
  const retry = app.nodes('Pressable').find(node => node.props.children?.props?.children === 'Retry loading');
  assert.ok(retry); app.defer(); retry.props.onPress(); app.render(); await app.flush();
  assert.ok(headerSpinner(app)); assert.ok(app.nodes('FlatList')[0].props.ListHeaderComponent);
  app.resolve([message('2')]); await app.flush(); assert.equal(app.nodes('FlatList')[0].props.data.length, 2); app.unmount();
});
test('confirmed empty chat uses header loading on foreground refresh', async () => {
  const app = harness(); app.render(); app.resolve([]); await app.flush();
  app.defer(); app.foreground(); await app.flush();
  assert.ok(headerSpinner(app)); assert.equal(app.nodes('FlatList')[0].props.data.length, 0);
  app.resolve([]); await app.flush(); assert.equal(headerSpinner(app), undefined); app.unmount();
});
test('session metadata does not reset chat and late blurred responses are ignored', async () => {
  const app = harness(); app.render(); app.resolve([message('1')]); await app.flush();
  app.newSessionObject(); assert.equal(headerSpinner(app), undefined); assert.equal(app.opens, 1);
  app.defer(); app.poll(); await app.flush(); app.focus(false); app.resolve([message('2')]); await app.flush();
  assert.equal(app.nodes('FlatList')[0].props.data.length, 1); app.unmount();
});
