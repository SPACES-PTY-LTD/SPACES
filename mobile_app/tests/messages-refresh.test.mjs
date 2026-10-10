import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const message = id => ({ message_id: id, created_at: `2026-10-09T10:00:0${id}Z`, attachments: [], body: `Message ${id}` });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function harness(initialParams = {}) {
  let params = { ...initialParams };
  let pickedAssets = [], actions;
  const slots = [], effects = [], timers = new Map(), frames = new Map();
  let focusCount = 0;
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
    'expo-router': { router: { setParams: patch => { params = { ...params, ...patch }; } }, useLocalSearchParams: () => params, useFocusEffect: callback => effect(() => focused ? callback() : undefined, [callback, focused]) },
    'react-native': { ...Object.fromEntries(['ActivityIndicator', 'FlatList', 'KeyboardAvoidingView', 'Pressable', 'TextInput', 'View'].map(key => [key, key])), Keyboard: { dismiss() {} }, Platform: { OS: 'ios' }, StyleSheet: { create: styles => styles }, AppState: { currentState: 'active', addEventListener: (_, callback) => { listener = callback; return { remove() {} }; } } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'light' }) },
    '@/src/providers/auth-provider': { useAuth: () => state },
    '@/src/providers/unread-messages-provider': { useUnreadMessages: () => ({ refresh: refreshUnread }) },
    '@/src/providers/message-notifications': { setVisibleDriverChat() {} },
    '@/component/ui/Text': { Text: 'Text' }, '@/component/ui/PageHeader': { PageHeader: 'PageHeader' },
    '@/component/ui/ActionSheet': { ActionSheet: 'ActionSheet' },
    '@/src/lib/api': { chatApi: { openDriver: async () => { opens++; return chat; }, show: async () => chat, messages: async () => await next.promise, read: async () => {} } },
    '@/src/components/shipments/ShipmentDetails': { ShipmentDetailsSheet: 'ShipmentDetailsSheet' },
    '@/src/components/runs/RunDetailsSheet': { RunDetailsSheet: 'RunDetailsSheet' },
    '@gorhom/bottom-sheet': {},
    'expo-image': { Image: 'Image' }, '@expo/vector-icons': { Feather: 'Feather' },
    'expo-document-picker': { getDocumentAsync: async () => ({ canceled: false, assets: pickedAssets }) }, 'expo-image-picker': {}, 'expo-crypto': {}, '@/src/components/ChatReferenceSheet': {},
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../app/(tabs)/messages.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { exports, require: name => { if (name.endsWith('.svg')) return name; assert.ok(name in modules, name); return modules[name]; }, Error, Map, Date, requestAnimationFrame: callback => { frames.set(callback, callback); return callback; }, cancelAnimationFrame: id => frames.delete(id), setTimeout() {}, setInterval: callback => { timers.set(callback, callback); return callback; }, clearInterval: id => timers.delete(id) });
  function render() { cursor = 0; const child = exports.default(); tree = child.type(child.props); nodes('ActionSheet').forEach(node => { node.props.ref.current = { present(value) { actions = value.actions; } }; }); nodes('TextInput').forEach(node => { if (node.props.ref) node.props.ref.current = { focus() { focusCount++; } }; }); while (effects.length) effects.shift()(); }
  function nodes(type) {
    const result = [];
    function visit(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit); if (node.type === type) result.push(node); visit(node.props?.children); }
    visit(tree); return result;
  }
  return {
    async pickFiles(assets) { pickedAssets = assets; nodes('Pressable').find(n => n.props.accessibilityLabel === 'Add attachment').props.onPress(); await actions.find(a => a.id === 'file').onPress(); render(); },
    requestShipment(id, request = id) { params = { draft_shipment_id: id, draft_shipment_label: `Shipment ${id}`, draft_shipment_request: request, draft_owner: 'driver' }; render(); },
    closed() { chat.status = 'closed'; },
    owner(value) { params.draft_owner = value; },
    frames() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); },
    get focusCount() { return focusCount; },
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

const shipmentParams = { draft_shipment_id: 'shipment-1', draft_shipment_label: 'Shipment 123', draft_shipment_request: 'request-1', draft_owner: 'driver' };
function removeShipment(app) { return app.nodes('Pressable').find(node => node.props.accessibilityLabel?.startsWith('Remove Shipment')); }
test('shipment dispatch opens a removable draft and never reattaches after removal or refocus', async () => {
  const app = harness(shipmentParams); app.render(); app.resolve([]); await app.flush(); app.render();
  assert.ok(removeShipment(app)); app.frames(); assert.equal(app.focusCount, 1); removeShipment(app).props.onPress(); app.render();
  assert.equal(removeShipment(app), undefined);
  app.focus(false); app.focus(true); await app.flush(); app.render(); assert.equal(removeShipment(app), undefined); app.frames(); assert.equal(app.focusCount, 1); app.unmount();
});
test('shipment handoff preserves text, avoids duplicates and respects attachment limit', async () => {
  const app = harness(); app.render(); app.resolve([]); await app.flush();
  app.nodes('TextInput')[0].props.onChangeText('Please help with this delivery'); app.render();
  for (let i = 1; i <= 5; i++) { app.requestShipment(`shipment-${i}`); app.render(); }
  app.requestShipment('shipment-1', 'another-request'); app.render();
  assert.equal(app.nodes('Pressable').filter(node => node.props.accessibilityLabel?.startsWith('Remove Shipment')).length, 5);
  assert.equal(app.nodes('TextInput')[0].props.value, 'Please help with this delivery');
  app.requestShipment('shipment-6'); app.render(); assert.equal(app.nodes('Pressable').filter(node => node.props.accessibilityLabel?.startsWith('Remove Shipment')).length, 5);
  assert.ok(app.nodes('Text').some(node => typeof node.props.children === 'string' && node.props.children.includes('Choose up to five'))); app.unmount();
});
test('closed chats and another account do not receive shipment handoff', async () => {
  for (const otherOwner of [false, true]) {
    const app = harness(shipmentParams); if (otherOwner) app.owner('another-driver'); else app.closed();
    app.render(); app.resolve([]); await app.flush(); app.render(); assert.equal(removeShipment(app), undefined); app.frames(); assert.equal(app.focusCount, 0); app.unmount();
  }
});

test('shipment focus waits for loaded composer and cancels on blur', async () => {
  const app = harness(shipmentParams); app.render(); await app.flush(); app.render(); app.frames(); assert.equal(app.focusCount, 0);
  app.resolve([]); await app.flush(); app.render(); app.focus(false); app.frames(); assert.equal(app.focusCount, 0);
  app.focus(true); await app.flush(); app.render(); app.frames(); assert.equal(app.focusCount, 1); app.unmount();
});

test('draft shipment opens scoped bottom sheet and closing preserves draft', async () => {
  const app = harness(shipmentParams); app.render(); app.resolve([]); await app.flush(); app.render();
  const open = app.nodes('Pressable').find(node => node.props.accessibilityLabel === 'Open Shipment 123');
  open.props.onPress(); app.render(); const sheet = app.nodes('ShipmentDetailsSheet')[0];
  assert.equal(sheet.props.shipmentId, 'shipment-1'); assert.equal(sheet.props.autoPresent, true);
  sheet.props.onDismiss(); app.render(); assert.ok(removeShipment(app)); assert.equal(app.nodes('ShipmentDetailsSheet').length, 0); app.unmount();
});
test('sent run and completed shipment references open sheets without navigation', async () => {
  const app = harness(); app.render();
  const item = { ...message('1'), attachments: [{ attachment_id: 'a', filename: 'Run 123', reference: { type: 'run', id: 'run-1', label: 'Run 123' } }, { attachment_id: 'b', filename: 'Shipment 123', reference: { type: 'shipment', id: 'shipment-1', run_id: 'completed-run', label: 'Shipment 123' } }] };
  app.resolve([item]); await app.flush(); app.render();
  function buttons(node, result = []) { if (!node || typeof node !== 'object') return result; if (Array.isArray(node)) { node.forEach(n => buttons(n, result)); return result; } if (node.type === 'Pressable') result.push(node); buttons(node.props?.children, result); return result; }
  const row = app.nodes('FlatList')[0].props.renderItem({ item });
  buttons(row).find(n => n.props.accessibilityLabel === 'Open Run 123').props.onPress(); app.render();
  assert.equal(app.nodes('RunDetailsSheet')[0].props.runId, 'run-1'); app.nodes('RunDetailsSheet')[0].props.onDismiss(); app.render();
  buttons(row).find(n => n.props.accessibilityLabel === 'Open Shipment 123').props.onPress(); app.render();
  assert.equal(app.nodes('ShipmentDetailsSheet')[0].props.runId, 'completed-run'); app.unmount();
});


test('draft pictures preview local images without filenames; documents retain names and removal preserves text', async () => {
  const app = harness(); app.render(); app.resolve([]); await app.flush();
  app.nodes('TextInput')[0].props.onChangeText('Keep this draft'); app.render();
  await app.pickFiles([
    { uri: 'file:///photo', name: 'generated-photo.jpg', mimeType: 'image/jpeg' },
    { uri: 'file:///heic', name: 'camera.HEIC' },
    { uri: 'file:///png', name: 'scan.png', mimeType: 'application/octet-stream' },
    { uri: 'file:///pdf', name: 'delivery.pdf', mimeType: 'application/pdf' },
    { uri: 'file:///text', name: 'misleading.jpg', mimeType: 'text/plain' },
  ]);
  const previews = app.nodes('Image').filter(n => n.props.source?.uri);
  assert.deepEqual(previews.map(n => n.props.source.uri), ['file:///photo', 'file:///heic', 'file:///png']);
  const visibleText = app.nodes('Text').map(n => n.props.children);
  assert.ok(!visibleText.includes('generated-photo.jpg')); assert.ok(!visibleText.includes('camera.HEIC'));
  assert.ok(visibleText.includes('delivery.pdf')); assert.ok(visibleText.includes('misleading.jpg'));
  app.nodes('Pressable').find(n => n.props.accessibilityLabel === 'Remove generated-photo.jpg').props.onPress(); app.render();
  assert.equal(app.nodes('Image').filter(n => n.props.source?.uri).length, 2);
  assert.equal(app.nodes('TextInput')[0].props.value, 'Keep this draft');
  assert.equal(app.nodes('Pressable').find(n => n.props.accessibilityLabel === 'Send message').props.disabled, false);
  app.unmount();
});
