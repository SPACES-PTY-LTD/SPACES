import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { Platform, TurboModuleRegistry } from 'react-native';

/** Old installed builds and Expo Go retain the preview without importing enforcing native modules. */
export const navigationSdk: typeof import('@googlemaps/react-native-navigation-sdk') | null =
  Constants.expoConfig?.extra?.navigationEnabled !== false && Platform.OS !== 'web' && !isRunningInExpoGo() && TurboModuleRegistry.get('NavModule')
    // Lazy import is required: the SDK enforces a native module at module evaluation.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ? require('@googlemaps/react-native-navigation-sdk') : null;
