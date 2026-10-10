import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness(file, extra = {}, instrument = source => source) {
  const slots = [], effects = [], shared = [], gestures = {};
  let cursor = 0, sc = 0, tree;
  const gesture = type => { const callbacks = {}; const value = { maxPointers: () => value }; for (const name of ['onStart', 'onUpdate', 'onEnd']) value[name] = cb => { callbacks[name] = cb; return value; }; gestures[type] = callbacks; return value; };
  const modules = {
    react: {
      useState(initial) { const i = cursor++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
      useEffect(cb, deps) { const i = cursor++; if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) { slots[i]?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = cb(); }); } },
    },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { ...Object.fromEntries(['Modal', 'Pressable', 'View', 'ActivityIndicator'].map(type => [type, type])), StyleSheet: { create: value => value, absoluteFill: {} } },
    'expo-image': { Image: 'Image' }, '@expo/vector-icons': { Feather: 'Feather' }, '@/component/ui/Text': { Text: 'Text' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 20 }) },
    'react-native-reanimated': { default: { View: 'AnimatedView' }, runOnJS: cb => cb, useAnimatedStyle: cb => cb(), useSharedValue(initial) { const i = sc++; shared[i] ??= { value: initial }; return shared[i]; } },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureRoot', GestureDetector: 'GestureDetector', Gesture: { Pinch: () => gesture('pinch'), Pan: () => gesture('pan'), Simultaneous: () => ({}) } },
    './ChatImage': { ChatImage: 'ChatImage' },
    '@/src/lib/chat-images': { photoPanOffset: (value, size, scale) => Math.max(-size * (scale - 1) / 2, Math.min(size * (scale - 1) / 2, value)), photoSwipeDirection: distance => Math.abs(distance) >= 50 ? (distance < 0 ? 1 : -1) : 0 }, ...extra,
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(instrument(readFileSync(new URL(`../src/components/${file}.tsx`, import.meta.url), 'utf8')), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; }, Math });
  return { shared, gestures, render(name, props) { cursor = sc = 0; tree = exports[name](props); while (effects.length) effects.shift()(); }, nodes(type) { const result = []; function visit(n) { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(visit); if (n.type === type) result.push(n); visit(n.props?.children); } visit(tree); return result; }, cleanup() { slots.forEach(slot => slot?.cleanup?.()); } };
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const ip = { token: 'private-token', conversationId: 'chat', attachment: { attachment_id: 'photo', filename: 'photo.jpg' }, onRetry() {} };
const preview = api => harness('ChatImage', { '@/src/lib/api': { chatApi: api } }, source => source.replace('function PrivateImage(', 'export function PrivateImage('));
test('private preview authorizes, shows loading and avoids disk caching', async () => {
  const pending = deferred(), calls = []; const app = preview({ download: (...args) => { calls.push(args); return pending.promise; } });
  app.render('PrivateImage', ip); assert.equal(app.nodes('ActivityIndicator').length, 1); assert.deepEqual(calls[0], ['private-token', 'chat', 'photo']);
  pending.resolve({ url: 'https://example.test/signed' }); await flush(); app.render('PrivateImage', ip);
  const image = app.nodes('Image')[0].props; assert.equal(image.cachePolicy, 'none'); assert.equal(image.source.uri, 'https://example.test/signed'); image.onLoad(); app.render('PrivateImage', ip); assert.equal(app.nodes('ActivityIndicator').length, 0);
});
test('URL and image failures offer retry and late unmounted responses are ignored', async () => {
  for (const fail of [true, false]) { let retries = 0; const props = { ...ip, onRetry: () => retries++ }; const app = preview({ download: async () => { if (fail) throw new Error('Forbidden'); return { url: 'https://example.test/expired' }; } });
    app.render('PrivateImage', props); await flush(); app.render('PrivateImage', props); if (!fail) { app.nodes('Image')[0].props.onError(); app.render('PrivateImage', props); }
    assert.equal(app.nodes('ActivityIndicator').length, 0); assert.equal(app.nodes('Image').length, 0); app.nodes('Pressable')[0].props.onPress(); assert.equal(retries, 1);
  }
  const pending = deferred(), app = preview({ download: () => pending.promise }); app.render('PrivateImage', ip); app.cleanup(); pending.resolve({ url: 'stale' }); await flush(); app.render('PrivateImage', ip); assert.equal(app.nodes('Image').length, 0);
});
const vp = { token: 'token', conversationId: 'chat', images: [{ attachment_id: 'a' }, { attachment_id: 'b' }], initialId: 'a', onClose() {} };
test('viewer swipes, bounds zoom and pan, and suppresses photo changes while zoomed', () => {
  const app = harness('ChatPhotoViewer'); app.render('ChatPhotoViewer', vp); app.gestures.pan.onStart(); app.gestures.pan.onEnd({ translationX: -80, translationY: 0, velocityX: 0 }); app.render('ChatPhotoViewer', vp); assert.equal(app.nodes('ChatImage')[0].props.attachment.attachment_id, 'b');
  app.nodes('View').find(n => n.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 200, height: 400 } } }); app.render('ChatPhotoViewer', vp);
  app.gestures.pinch.onStart(); app.gestures.pinch.onUpdate({ scale: 9 }); app.gestures.pinch.onEnd(); assert.equal(app.shared[0].value, 5);
  app.gestures.pan.onStart(); app.gestures.pan.onUpdate({ translationX: 2000, translationY: -2000 }); assert.equal(app.shared[2].value, 400); assert.equal(app.shared[3].value, -800);
  app.gestures.pan.onEnd({ translationX: 80, translationY: 0, velocityX: 0 }); app.render('ChatPhotoViewer', vp); assert.equal(app.nodes('ChatImage')[0].props.attachment.attachment_id, 'b');
  app.nodes('Pressable').find(n => n.props.accessibilityLabel === 'Reset photo zoom').props.onPress(); assert.equal(app.shared[0].value, 1); assert.equal(app.shared[2].value, 0);
});
test('viewer supports accessible next/previous, zoom reset on page change and close/Android Back', () => {
  let closed = 0; const props = { ...vp, onClose: () => closed++ }, app = harness('ChatPhotoViewer'); app.render('ChatPhotoViewer', props);
  assert.equal(app.nodes('Pressable').find(n => n.props.accessibilityLabel === 'Previous photo').props.disabled, true);
  app.gestures.pinch.onStart(); app.gestures.pinch.onUpdate({ scale: 2 }); app.nodes('Pressable').find(n => n.props.accessibilityLabel === 'Next photo').props.onPress(); app.render('ChatPhotoViewer', props); assert.equal(app.shared[0].value, 1);
  assert.equal(app.nodes('Pressable').find(n => n.props.accessibilityLabel === 'Next photo').props.disabled, true); app.nodes('Modal')[0].props.onRequestClose(); app.nodes('Pressable').find(n => n.props.accessibilityLabel === 'Close photo viewer').props.onPress(); assert.equal(closed, 2);
});
