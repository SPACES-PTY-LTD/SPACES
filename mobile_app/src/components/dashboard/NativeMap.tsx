import { Component, forwardRef, useSyncExternalStore, type ReactNode } from 'react';
import { isRunningInExpoGo } from 'expo';
import { Platform, StyleSheet, UIManager, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type MapViewProps } from 'react-native-maps';
import { Text } from '@/component/ui/Text';
import { nativeMapCapabilities, selectNativeMapProvider, type NativeMapProvider } from './native-map-provider';
import { runMapStyle, runMapDarkStyle } from './run-map-style';

const capabilities = nativeMapCapabilities(Platform.OS, name => UIManager.hasViewManagerConfig(name), { isExpoGo: isRunningInExpoGo() });
const failed = new Set<NativeMapProvider>();
const listeners = new Set<() => void>();
const snapshot = () => selectNativeMapProvider(capabilities, failed);
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function changeProvider(provider: NativeMapProvider) {
  failed.add(provider);
  listeners.forEach(listener => listener());
}

function MapUnavailable({ dark }: { dark: boolean }) {
  return <View style={[styles.unavailable, { backgroundColor: dark ? '#27272a' : '#f4f4f5' }]} accessibilityRole="text">
    <Text style={{ color: dark ? '#fafafa' : '#18181b', fontWeight: '600' }}>Map unavailable</Text>
    <Text style={[styles.message, { color: dark ? '#a1a1aa' : '#71717a' }]}>Location details are still available. Reopen the app to try the map again.</Text>
  </View>;
}

/** React errors are catchable; native SDK crashes and silent tile failures are not. */
class MapRenderBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

type NativeMapProps = Omit<MapViewProps, 'provider' | 'customMapStyle' | 'mapType'> & { dark?: boolean };

/** One provider policy for every native map, retaining caller coordinates, children and ref. */
export const NativeMap = forwardRef<MapView, NativeMapProps>(function NativeMap({ dark = false, style, children, onMapReady, ...props }, ref) {
  const provider = useSyncExternalStore(subscribe, snapshot, snapshot);
  const fallback = <MapUnavailable dark={dark} />;
  return <View style={style}>
    {provider === 'unavailable' ? fallback : <MapRenderBoundary key={provider} fallback={fallback} onFailure={() => changeProvider(provider)}>
      <MapView {...props} ref={ref} style={StyleSheet.absoluteFill}
        provider={provider === 'google' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={provider === 'google' ? (dark ? runMapDarkStyle : runMapStyle) : undefined}
        mapType={provider === 'apple' ? 'mutedStandard' : 'standard'}
        userInterfaceStyle={dark ? 'dark' : 'light'}
        onMapReady={event => {
          if (__DEV__) console.info('[NativeMap] ready', { provider });
          onMapReady?.(event);
        }}>
        {children}
      </MapView>
    </MapRenderBoundary>}

  </View>;
});

const styles = StyleSheet.create({
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  message: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
