import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  const slots = [], effects = [], frames = new Map();
  let cursor = 0, rendered, presents = 0, dismisses = 0, closed = 0;
  const props = { shipmentId: 'shipment-1', autoPresent: true,
    modalRef: { current: { present() { presents++; }, dismiss() { dismisses++; } } },
    onDismiss() { closed++; } };
  const modules = {
    react: {
      useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
      useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
      useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) { slots[i]?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); }); } },
    },
    'react/jsx-runtime': { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) },
    '@gorhom/bottom-sheet': { BottomSheetModal: 'BottomSheetModal', BottomSheetBackdrop: 'BottomSheetBackdrop' },
    'react-native': { View: 'View', Platform: { OS: 'ios' }, useWindowDimensions: () => ({ height: 900 }), BackHandler: { addEventListener: () => ({ remove() {} }) } },
    'react-native-screens': { FullWindowOverlay: 'FullWindowOverlay' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 50, bottom: 34 }) },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'light' }) },
    '@/component/ui/sheet-handoff': { createSheetHandoff: () => ({ dispose() {}, onDismiss: () => false }) },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/components/shipments/ShipmentDetails.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => modules[name] ?? {}, requestAnimationFrame: fn => { frames.set(fn, fn); return fn; }, cancelAnimationFrame: fn => frames.delete(fn) });
  function render() { cursor = 0; rendered = exports.ShipmentDetailsSheet(props); while (effects.length) effects.shift()(); return rendered.props.renderSurface('receipt content'); }
  return { render, props, get closed() { return closed; }, get presents() { return presents; }, get dismisses() { return dismisses; },
    frames() { frames.forEach(fn => fn()); frames.clear(); }, close() { rendered.props.onClose(); },
  };
}

test('receipt backdrop is not remounted above the native receipt on open or data refresh', () => {
  const app = harness(); const initial = app.render();
  const backdrop = initial.props.backdropComponent;
  app.frames(); assert.equal(app.presents, 1);
  initial.props.onChange(0);
  const opened = app.render();
  assert.equal(opened.props.backdropComponent, backdrop, 'onChange must not recreate the backdrop component');
  app.props.refreshKey = 1;
  assert.equal(app.render().props.backdropComponent, backdrop, 'refresh must not change native backdrop order');
  const animatedIndex = { value: 0 }, animatedPosition = { value: 100 };
  const overlay = backdrop({ animatedIndex, animatedPosition });
  assert.equal(overlay.props.animatedIndex, animatedIndex);
  assert.equal(overlay.props.animatedPosition, animatedPosition);
  assert.equal(overlay.props.appearsOnIndex, 0);
  assert.equal(overlay.props.disappearsOnIndex, -1);
});

test('stable backdrop retains header close and post-removal host dismissal', () => {
  const app = harness(); const initial = app.render(); app.frames();
  initial.props.onChange(0); const opened = app.render();
  app.close(); assert.equal(app.dismisses, 1); assert.equal(app.closed, 0);
  opened.props.onDismiss(); app.render(); assert.equal(app.closed, 1);
  assert.equal(app.render().props.backdropComponent, initial.props.backdropComponent);
  assert.equal(app.closed, 1, 'ordinary rerenders must not repeat dismissal');
});
