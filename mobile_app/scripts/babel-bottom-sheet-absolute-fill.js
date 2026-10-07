// Gorhom v5 still uses the alias removed in React Native 0.86.
// Rewrite only that dependency's layout references, without modifying node_modules.
module.exports = function bottomSheetAbsoluteFill({ types: t }) {
  return {
    name: 'bottom-sheet-absolute-fill',
    visitor: {
      MemberExpression(path) {
        if (t.isIdentifier(path.node.object, { name: 'StyleSheet' }) &&
            !path.node.computed &&
            t.isIdentifier(path.node.property, { name: 'absoluteFillObject' })) {
          path.node.property = t.identifier('absoluteFill');
        }
      },
    },
  };
};
