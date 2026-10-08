export type NativeMapProvider = 'google' | 'apple' | 'unavailable';
export type NativeMapCapabilities = { google: boolean; apple: boolean };

/** Expo Go on iOS cannot use the app's native Google configuration, even if a view is registered. */
export function nativeMapCapabilities(platform: string, hasView: (name: string) => boolean, runtime: { isExpoGo: boolean }): NativeMapCapabilities {
  const available = (name: string) => {
    try { return hasView(name); } catch { return false; }
  };
  const standard = available('RNMapsMapView') || available('AIRMap');
  return {
    google: platform === 'android' ? standard : platform === 'ios' && !runtime.isExpoGo && (available('RNMapsGoogleMapView') || available('AIRGoogleMap')),
    apple: platform === 'ios' && standard,
  };
}

export function selectNativeMapProvider(capabilities: NativeMapCapabilities, failed: ReadonlySet<NativeMapProvider>, preferApple = false): NativeMapProvider {
  if (preferApple && capabilities.apple && !failed.has('apple')) return 'apple';
  if (capabilities.google && !failed.has('google')) return 'google';
  if (capabilities.apple && !failed.has('apple')) return 'apple';
  return 'unavailable';
}
