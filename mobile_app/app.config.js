// Native Google Maps keys are supplied by the build environment, never committed.
if (process.env.EAS_BUILD === 'true') {
  const mapsKeyName = process.env.EAS_BUILD_PLATFORM === 'ios'
    ? 'GOOGLE_MAPS_IOS_API_KEY'
    : process.env.EAS_BUILD_PLATFORM === 'android' ? 'GOOGLE_MAPS_ANDROID_API_KEY' : null;
  if (mapsKeyName && !process.env[mapsKeyName]) {
    throw new Error(`Missing ${mapsKeyName} in the EAS build environment. Configure the Maps key before building.`);
  }
}
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    '@react-native-community/datetimepicker',
    'expo-notifications',
    ['expo-dev-client', { launchMode: 'most-recent' }],
    ["expo-image-picker", { photosPermission: "Allow Spaces Digital to choose delivery note photos.", cameraPermission: "Allow Spaces Digital to photograph delivery notes.", microphonePermission: false }],
    ["react-native-maps", {
      ...(process.env.GOOGLE_MAPS_ANDROID_API_KEY ? { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } : {}),
      ...(process.env.GOOGLE_MAPS_IOS_API_KEY ? { iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY } : {}),
    }],
  ],
  ios: {
    ...config.ios,
    config: {
      ...config.ios?.config,
    },
  },
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
    config: {
      ...config.android?.config,
    },
  },
});
