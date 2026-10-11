import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  let cursor = 0, tree, selected = { canceled: false, assets: [{ uri: 'file://photo.jpg', fileName: 'photo.jpg', mimeType: 'image/jpeg', fileSize: 1000 }] };
  const slots = [], calls = [], effects = [];
  let actions, fail = false;
  const auth = { session: { token: 'driver-token', user: { name: 'Driver', telephone: '123' } }, updateSessionUser: async user => { calls.push(['session', user]); auth.session.user = user; } };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: { useState(value) { const i = cursor++; slots[i] ??= { value }; return [slots[i].value, value => { slots[i].value = value; }]; }, useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i]; }, useMemo: fn => fn(), useEffect: fn => { const i = cursor++; if (!slots[i]) { slots[i] = {}; effects.push(fn); } } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'expo-router': { useRouter: () => ({ back: () => calls.push(['back']) }) },
    'react-native': Object.fromEntries(['ActivityIndicator', 'Pressable', 'ScrollView', 'TextInput', 'View'].map(x => [x, x])),
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    'expo-image': { Image: 'Image' }, '@expo/vector-icons': { Feather: 'Feather' },
    'expo-image-picker': { launchImageLibraryAsync: async () => selected, launchCameraAsync: async () => selected, requestCameraPermissionsAsync: async () => ({ granted: true }) },
    '@/component/ui/Text': { Text: 'Text' }, '@/component/ui/ActionSheet': { ActionSheet: 'ActionSheet' },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'light' }) },
    '@/src/providers/auth-provider': { useAuth: () => auth },
    '@/src/lib/api': { driverApi: { updateProfile: async (_, payload) => { calls.push(['profile', payload]); return { ...auth.session.user, ...payload }; }, updateProfilePhoto: async (token, photo) => { calls.push(['photo', token, photo]); if (fail) throw new Error('Upload failed'); return { ...auth.session.user, profile_photo_url: 'https://photo' }; } } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/account/edit-profile.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: key => { if (!modules[key]) throw new Error(key); return modules[key]; } });
  const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  function render() { cursor = 0; tree = exports.EditProfileForm(); effects.splice(0).forEach(fn => fn()); nodes(tree).find(n => n.type === 'ActionSheet').props.ref.current = { present: config => { actions = config.actions; } }; }
  const button = label => nodes(tree).find(n => n.type === 'Pressable' && nodes(n).some(child => child.type === 'Text' && child.props.children === label));
  render();
  return { calls, render, button, async choose(result) { if (result) selected = result; button('Add picture')?.props.onPress() ?? button('Change picture')?.props.onPress(); await actions[0].onPress(); render(); }, fail() { fail = true; }, texts: () => nodes(tree).filter(n => n.type === 'Text').map(n => n.props.children) };
}

test('photo-only save uploads selected image and updates the account session', async () => {
  const h = harness(); assert.equal(h.button('Save').props.disabled, true);
  await h.choose(); assert.equal(h.button('Save').props.disabled, false);
  await h.button('Save').props.onPress();
  assert.deepEqual(h.calls.map(c => c[0]), ['photo', 'session', 'back']);
  assert.equal(h.calls[0][1], 'driver-token'); assert.equal(h.calls[0][2].uri, 'file://photo.jpg');
});
test('cancelled picker and oversize photo do not enable saving', async () => {
  const h = harness(); await h.choose({ canceled: true }); assert.equal(h.button('Save').props.disabled, true);
  await h.choose({ canceled: false, assets: [{ uri: 'file://large.jpg', fileSize: 6 * 1024 * 1024 }] });
  assert.equal(h.button('Save').props.disabled, true); assert.ok(h.texts().includes('Choose a picture smaller than 5 MB.'));
});
test('failed upload retains the preview and can be retried', async () => {
  const h = harness(); await h.choose(); h.fail(); await h.button('Save').props.onPress(); h.render();
  assert.ok(h.texts().includes('Upload failed')); assert.equal(h.button('Save').props.disabled, false);
  assert.deepEqual(h.calls.map(c => c[0]), ['photo']);
});
test('undo discards the draft picture without uploading', async () => {
  const h = harness(); await h.choose(); h.button('Undo picture change').props.onPress(); h.render();
  assert.equal(h.button('Save').props.disabled, true); assert.equal(h.calls.length, 0);
});
