/** Keep native navigation out of Metro's web dependency graph. */
export const navigationSdk: typeof import('@googlemaps/react-native-navigation-sdk') | null = null;
