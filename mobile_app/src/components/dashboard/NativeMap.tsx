import { Component, forwardRef, useSyncExternalStore, type ReactNode } from 'react';
import { isRunningInExpoGo } from 'expo';
import { Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type MapViewProps } from 'react-native-maps';
import { Text } from '@/component/ui/Text';
import { nativeMapCapabilities, selectNativeMapProvider, type NativeMapProvider } from './native-map-provider';
import { runMapStyle } from './run-map-style';

const capabilities = nativeMapCapabilities(Platform.OS, name => UIManager.hasViewManagerConfig(name), { isExpoGo: isRunningInExpoGo() });
const failed = new Set<NativeMapProvider>();
const listeners = new Set<() => void>();
let preferApple = false;
const snapshot = () => selectNativeMapProvider(capabilities, failed, preferApple);
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function changeProvider(provider?: NativeMapProvider) {
  if (provider) failed.add(provider);
  else preferApple = true;
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

type NativeMapProps = Omit<MapViewProps, 'provider' | 'customMapStyle' | 'mapType'> & { dark?: boolean; recoveryTopInset?: number };

/** One provider policy for every native map, retaining caller coordinates, children and ref. */
export const NativeMap = forwardRef<MapView, NativeMapProps>(function NativeMap({ dark = false, recoveryTopInset = 0, style, children, onMapReady, ...props }, ref) {
  const provider = useSyncExternalStore(subscribe, snapshot, snapshot);
  const fallback = <MapUnavailable dark={dark} />;
  return <View style={style}>
    {provider === 'unavailable' ? fallback : <MapRenderBoundary key={provider} fallback={fallback} onFailure={() => changeProvider(provider)}>
      <MapView {...props} ref={ref} style={StyleSheet.absoluteFill}
        provider={provider === 'google' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={provider === 'google' && !dark ? runMapStyle : undefined}
        mapType={provider === 'apple' ? 'mutedStandard' : 'standard'}
        userInterfaceStyle={dark ? 'dark' : 'light'}
        onMapReady={event => {
          if (__DEV__) console.info('[NativeMap] ready', { provider });
          onMapReady?.(event);
        }}>
        {children}
      </MapView>
    </MapRenderBoundary>}
    {provider === 'google' && capabilities.apple && !failed.has('apple') && <Pressable
      accessibilityRole="button" accessibilityLabel="Map not loading? Use Apple Maps"
      onPress={() => changeProvider()}
      style={[styles.recovery, { top: recoveryTopInset + 8, backgroundColor: dark ? '#27272a' : '#ffffff' }]}>
      <Text style={{ color: dark ? '#fafafa' : '#18181b', fontSize: 12, fontWeight: '600' }}>Use Apple Maps</Text>
    </Pressable>}
  </View>;
});

const styles = StyleSheet.create({
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  message: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  recovery: { position: 'absolute', left: 12, minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#a1a1aa' },
});
