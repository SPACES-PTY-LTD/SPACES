import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  let auth = { isHydrating: true, session: null };
  const Stack = Object.assign(() => {}, { Screen: 'Screen', Protected: 'Protected' });
  const jsx = (type, props) => ({ type, props });
  const modules = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'expo-router': { Stack, useRootNavigationState: () => undefined, useSegments: () => ['(tabs)'] },
    '@/src/providers/auth-provider': { useAuth: () => auth },
    '@/src/components/BrandLoadingScreen': { BrandLoadingScreen: 'Loading' },
  };
  const exports = {};
  const source = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(`${source}\nexport { RootNavigator };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: key => modules[key] ?? {} });
  return { Stack, render(next) { auth = next; return exports.RootNavigator(); } };
}

test('fresh navigator mounts after hydration without waiting for its own state', () => {
  const app = harness();
  assert.equal(app.render({ isHydrating: true, session: null }).type, 'Loading');
  for (const session of [null, { token: 'active' }, null]) {
    const tree = app.render({ isHydrating: false, session });
    assert.equal(tree.type, app.Stack);
    const [publicRoutes, privateRoutes] = tree.props.children;
    assert.equal(publicRoutes.props.guard, !session);
    assert.equal(privateRoutes.props.guard, !!session);
    assert.deepEqual(Array.from(publicRoutes.props.children, child => child.props.name), ['(auth)/login', '(auth)/register']);
    assert.ok(privateRoutes.props.children.some(child => child.props.name === '(tabs)'));
    assert.ok(privateRoutes.props.children.some(child => child.props.name === 'account/location'));
  }
});
