import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness(overrides = {}) {
  const slots = [], effects = [], saves = []; let cursor = 0, tree;
  let props = { status: 'failed', onStatusChange: status => { props.status = status; }, collectionOdometer: 395434, deliveryOdometer: null, busy: false, onSave: payload => saves.push(payload), onDismiss() {}, ...overrides };
  const modules = {
    react: { useRef: initial => { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; }, useState: initial => { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = value; }]; }, useEffect: fn => { const i = cursor++; if (!slots[i]) { slots[i] = {}; effects.push(fn); } } },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    '@expo/vector-icons': { Feather: 'Feather' }, '@gorhom/bottom-sheet': { BottomSheetTextInput: 'TextInput' },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', TextInput: 'TextInput', View: 'View' },
    '@/component/ui/BottomSheet': { BottomSheet: 'BottomSheet' }, '@/component/ui/Text': { Text: 'Text' },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'dark' }) },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/components/shipments/DeliveryStatusSheet.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => modules[name], requestAnimationFrame: fn => { effects.push(fn); return 1; }, cancelAnimationFrame() {} });
  function nodes(type) { const result = []; function visit(n) { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(visit); if (n.type === type) result.push(n); visit(n.props?.children); visit(n.props?.footer); } visit(tree); return result; }
  const app = { saves, nodes, render(changes = {}) { props = { ...props, ...changes }; cursor = 0; tree = exports.DeliveryStatusSheet(props); while (effects.length) effects.shift()(); return tree; }, press(label) { const n = nodes('Pressable').find(n => n.props.accessibilityLabel === label); assert.ok(n, label); n.props.onPress(); app.render(); }, input(label, value) { const n = nodes('TextInput').find(n => n.props.accessibilityLabel === label); assert.ok(n, label); n.props.onChangeText(value); app.render(); }, saveButton() { return nodes('Pressable').find(n => n.props.accessibilityLabel === 'Save status'); } };
  app.render(); return app;
}
test('preset reason saves a note without collection odometer or message input', () => {
  const app = harness(); assert.equal(app.saveButton().props.disabled, true);
  app.press('Reason · Required');
  const options = app.nodes('Pressable').filter(n => n.props.accessibilityRole === 'radio'); assert.equal(options.at(-1).props.accessibilityLabel, 'Other');
  app.press('Recipient unavailable'); assert.equal(app.nodes('TextInput').length, 0);
  app.press('Save status'); assert.deepEqual(JSON.parse(JSON.stringify(app.saves)), [{ status: 'failed', note: 'Recipient unavailable' }]);
  assert.equal('odometer_at_collection' in app.saves[0], false);
});
test('Other requires a trimmed message and switching away removes custom message payload', () => {
  const app = harness(); app.press('Reason · Required'); app.press('Other');
  app.input('Failure message', '   '); assert.equal(app.saveButton().props.disabled, true);
  app.input('Failure message', '  Road blocked  '); app.press('Save status'); assert.equal(app.saves[0].note, 'Road blocked');
  app.press('Reason · Required'); app.press('Delivery refused'); assert.equal(app.nodes('TextInput').length, 0);
  app.press('Save status'); assert.equal(app.saves[1].note, 'Delivery refused');
});
test('missing collection blocks save; delivered submits no manual odometer', () => {
  const missing = harness({ collectionOdometer: null }); missing.press('Reason · Required'); missing.press('Recipient unavailable');
  assert.equal(missing.saveButton().props.disabled, true); missing.press('Save status'); assert.equal(missing.saves.length, 0);
  const app = harness({ status: 'delivered' });
  assert.equal(app.nodes('TextInput').some(n => n.props.accessibilityLabel === 'Delivery odometer'), false);
  assert.equal(app.saveButton().props.disabled, false);
  app.press('Save status'); assert.equal('odometer_at_delivery' in app.saves[0], false);
});
test('switching status excludes failure draft; busy and errors preserve recovery controls', () => {
  const app = harness(); app.press('Reason · Required'); app.press('Other'); app.input('Failure message', 'Custom reason');
  app.press('Status'); app.press('In transit'); app.input('Status note', '  On the way  '); app.press('Save status'); assert.equal(app.saves[0].status, 'in_transit'); assert.equal(app.saves[0].note, 'On the way');
  const sheet = app.render({ busy: true, error: 'Please retry' }); assert.equal(sheet.props.dismissible, false); assert.equal(app.saveButton().props.disabled, true);
  app.press('Save status'); assert.equal(app.saves.length, 1);
  assert.ok(app.nodes('Text').some(n => n.props.children === 'Please retry'));
  app.render({ busy: false }); assert.equal(app.saveButton().props.disabled, false);
});

test('keyboard-aware form expands above keyboard and keeps Save in the persistent footer', () => {
  const app = harness();
  const sheet = app.nodes('BottomSheet')[0];
  assert.equal(sheet.props.keyboardBehavior, 'fillParent');
  assert.equal(sheet.props.scrollable, true);
  assert.equal(sheet.props.contentPanning, false);
  assert.equal(sheet.props.footer.props.accessibilityLabel, 'Save status');
});
