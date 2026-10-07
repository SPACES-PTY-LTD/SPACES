// react-native-css-interop 0.2.1 registers the deprecated core SafeAreaView
// even when the app only uses safe-area-context. Remove that registration
// at build time; retain its separate safe-area-context registration below it.
module.exports = function ({ types: t }) {
  return {
    name: 'nativewind-remove-core-safe-area',
    visitor: {
      ExpressionStatement(path) {
        const call = path.node.expression;
        if (!t.isCallExpression(call)) return;
        const component = call.arguments[0];
        if (!t.isMemberExpression(component)
          || !t.isIdentifier(component.property, { name: 'SafeAreaView' })
          || !t.isIdentifier(component.object)) return;

        const binding = path.scope.getBinding(component.object.name);
        const init = binding?.path.node.init;
        if (t.isCallExpression(init)
          && t.isIdentifier(init.callee, { name: 'require' })
          && t.isStringLiteral(init.arguments[0], { value: 'react-native' })) {
          path.remove();
        }
      },
    },
  };
};
