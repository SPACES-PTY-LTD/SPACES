import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function sheet(overrides = {}) {
  let dismissed = 0;
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: { createContext: () => ({ Provider: 'Provider' }), useContext: () => true, useCallback: fn => fn, useEffect() {}, useState: value => [value, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@expo/vector-icons': { Feather: 'Feather' },
    '@gorhom/bottom-sheet': Object.fromEntries(['BottomSheetModal', 'BottomSheetBackdrop', 'BottomSheetFooter', 'BottomSheetScrollView', 'BottomSheetView'].map(name => [name, name])),
    'react-native': { Platform: { OS: 'ios' }, View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ height: 850 }) },
    'react-native-screens': { FullWindowOverlay: 'Overlay' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 50, bottom: 34 }) },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'light' }) },
    './Text': { Text: 'Text' }, './sheet-theme': { sheetTheme: { radius: 20 } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../component/ui/BottomSheet.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => modules[name] });
  const tree = exports.BottomSheet({ title: 'Options', modalRef: { current: { dismiss: () => dismissed++ } }, ...overrides });
  const modal = tree.props.children;
  const buttons = [];
  function visit(n) { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(visit); if (n.type === 'Pressable') buttons.push(n); visit(n.props?.children); }
  visit(tree);
  return { modal, close: buttons.find(n => n.props.accessibilityLabel === 'Close Options'), dismissed: () => dismissed };
}

test('closing a nested shared sheet does not restore a stale underlying index', () => {
  const h = sheet();
  // Gorhom switch minimizes and caches the current index; push skips minimization.
  let minimized = false;
  const savedIndex = 1, currentSnapPoints = [600];
  if (h.modal.props.stackBehavior === 'switch') minimized = true;
  h.close.props.onPress();
  assert.equal(h.dismissed(), 1);
  assert.equal(minimized, false);
  if (minimized) assert.ok(savedIndex < currentSnapPoints.length, 'restoration would throw the reported range error');
  assert.equal(h.modal.props.index, 0);
});

test('plain-scroll sheets retain one valid snap and busy sheets disable close', () => {
  const plain = sheet({ plainScroll: true });
  assert.equal(plain.modal.props.stackBehavior, 'push');
  assert.equal(plain.modal.props.enableDynamicSizing, false);
  assert.equal(plain.modal.props.snapPoints.length, 1);
  assert.ok(plain.modal.props.index < plain.modal.props.snapPoints.length);
  assert.equal(sheet({ dismissible: false }).close.props.disabled, true);
});

test('explicit replace behavior remains available', () => {
  assert.equal(sheet({ stackBehavior: 'replace' }).modal.props.stackBehavior, 'replace');
});
