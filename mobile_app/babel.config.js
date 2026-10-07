module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    overrides: [
      {
        test: (filename) => /node_modules[\\/]react-native-css-interop[\\/]dist[\\/]runtime[\\/]components\.js$/.test(filename || ""),
        plugins: [require.resolve('./scripts/babel-nativewind-safe-area')],
      },
      {
        test: (filename) => /node_modules[\\/]@gorhom[\\/]bottom-sheet[\\/]/.test(filename || ""),
        plugins: [require.resolve('./scripts/babel-bottom-sheet-absolute-fill')],
      },
      {
        // Preserve RN internals and Gorhom's animated layout styles on React's
        // runtime; these dependencies do not need NativeWind JSX wrappers.
        exclude: (filename) =>
          /node_modules[\\/](?:react-native[\\/]|@gorhom[\\/]bottom-sheet[\\/])/.test(filename || ""),
        presets: ["nativewind/babel"],
      },
    ],
  };
};
