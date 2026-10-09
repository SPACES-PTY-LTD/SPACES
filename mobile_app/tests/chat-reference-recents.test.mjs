import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(type) {
  const slots = [], effects = [], requests = [], attached = [];
  let cursor = 0, tree;
  const props = { token: 'token', conversationId: 'chat', type, onSelect: row => attached.push(row), onDismiss() {} };
  const modules = {
    react: {
      useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
      useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
      useCallback(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) slots[i] = { fn, deps }; return slots[i].fn; },
      useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) { slots[i]?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); }); } },
    },
    'react/jsx-runtime': { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) },
    'react-native': { ...Object.fromEntries(['View', 'Pressable', 'TextInput', 'ActivityIndicator'].map(name => [name, name])), StyleSheet: { create: styles => styles } },
    '@expo/vector-icons': { Feather: 'Feather' }, '@gorhom/bottom-sheet': {},
    '@/component/ui/BottomSheet': { BottomSheet: 'BottomSheet' }, '@/component/ui/Text': { Text: 'Text' },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'dark' }) },
    '@/src/lib/api': { chatApi: { references: (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })) } },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/components/ChatReferenceSheet.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; }, Map, Error, requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame() {} });
  function render() { cursor = 0; tree = exports.ChatReferenceSheet(props); while (effects.length) effects.shift()(); }
  function nodes(type) {
    const result = [];
    function visit(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit); if (node.type === type) result.push(node); visit(node.props?.children); }
    visit(tree); return result;
  }
  return { requests, props, attached, render, nodes,
    async flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); render(); },
    resolve(index, rows, lastPage = 1) { requests[index].resolve({ data: rows, meta: { current_page: requests[index].args[4] ?? 1, last_page: lastPage } }); },
    submit(value) { nodes('TextInput')[0].props.onChangeText(value); render(); nodes('TextInput')[0].props.onSubmitEditing(); render(); },
    clear() { nodes('Pressable').find(n => n.props.accessibilityLabel === 'Clear search').props.onPress(); render(); },
    more() { nodes('BottomSheet')[0].props.onScroll({ nativeEvent: { contentOffset: { y: 500 }, layoutMeasurement: { height: 500 }, contentSize: { height: 900 } } }); render(); },
    labels() { return nodes('Pressable').filter(n => n.props.accessibilityLabel?.includes(',')).map(n => n.props.accessibilityLabel); },
    text() { return nodes('Text').map(n => n.props.children).flat().join(' '); },
  };
}
const row = (type, id) => ({ type, id, label: id, subtitle: 'completed' });
for (const type of ['run', 'shipment']) {
  test(`${type}: opens with ten recents, search replaces them and clearing restores recents`, async () => {
    const app = harness(type); app.render();
    assert.equal(app.requests[0].args[3], '');
    assert.equal(app.nodes('TextInput')[0].props.autoFocus, undefined);
    app.resolve(0, Array.from({ length: 12 }, (_, i) => row(type, `recent-${i}`)), 2); await app.flush();
    assert.equal(app.labels().length, 10); assert.match(app.text(), /RECENT/);
    app.more(); assert.equal(app.requests.length, 1);
    app.submit('old'); app.resolve(1, [row(type, 'old-match')], 2); await app.flush();
    assert.deepEqual(app.labels(), ['old-match, completed']); assert.match(app.text(), /SEARCH RESULTS/);
    app.more(); assert.equal(app.requests[2].args[4], 2);
    app.clear(); app.resolve(3, [row(type, 'restored')]); await app.flush();
    app.resolve(2, [row(type, 'late-page')]); await app.flush();
    assert.deepEqual(app.labels(), ['restored, completed']);
  });
  test(`${type}: late recent response cannot overwrite search; selection still requires Attach`, async () => {
    const app = harness(type); app.render(); app.submit('target');
    app.resolve(1, [row(type, 'target')]); await app.flush();
    app.resolve(0, [row(type, 'stale')]); await app.flush();
    assert.deepEqual(app.labels(), ['target, completed']);
    app.nodes('Pressable').find(n => n.props.accessibilityLabel === 'target, completed').props.onPress(); app.render();
    assert.equal(app.attached.length, 0);
    app.nodes('Pressable').find(n => n.props.children?.[0]?.props.children?.join('') === `Attach ${type}`).props.onPress();
    app.nodes('BottomSheet')[0].props.onDismiss();
    assert.equal(app.attached[0].id, 'target');
  });
  test(`${type}: recent loading failures retry blank query and successful empty lists are explicit`, async () => {
    const app = harness(type); app.render(); app.requests[0].reject(new Error('Offline')); await app.flush();
    assert.match(app.text(), /Offline/); assert.doesNotMatch(app.text(), /No .* available/);
    app.nodes('Pressable').find(n => n.props.children?.props.children === 'Retry search').props.onPress();
    assert.equal(app.requests[1].args[3], '');
    app.resolve(1, []); await app.flush(); assert.match(app.text(), new RegExp(`No ${type}s available`));
  });
}
