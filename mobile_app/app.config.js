// Native Google Maps keys are supplied by the build environment, never committed.
module.exports = ({ config }) => ({
  ...config,
  plugins: [...(config.plugins || []), ["expo-image-picker", { photosPermission: "Allow Spaces to choose delivery note photos.", cameraPermission: "Allow Spaces to photograph delivery notes.", microphonePermission: false }]],
  ios: {
    ...config.ios,
    config: {
      ...config.ios?.config,
      ...(process.env.GOOGLE_MAPS_IOS_API_KEY ? { googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY } : {}),
    },
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      ...(process.env.GOOGLE_MAPS_ANDROID_API_KEY ? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } } : {}),
    },
  },
});
