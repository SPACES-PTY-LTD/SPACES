import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PixelRatio, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NavigationViewController } from '@googlemaps/react-native-navigation-sdk';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGuidance } from './GuidanceProvider';
import { navigationSdk } from './navigation-sdk';

// The dashboard map extends 28 points behind the sheet's rounded top.
// Reserve that overlap plus a visible 12-point gap for the whole guidance card.
const footerBottom = 28 + 12;

export function GuidanceMap({ topInset }: { topInset: number }) {
  const { state, exit, mute } = useGuidance();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const [view, setView] = useState<NavigationViewController | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [footerHeight, setFooterHeight] = useState(144);
  const [viewError, setViewError] = useState<string>();
  const sdk = navigationSdk!;
  const following = useCallback(() => {
    if (!mapReady || !view) return;
    void view.setFollowingPerspective(sdk.CameraPerspective.TILTED).then(() => { if (mounted.current) setViewError(undefined); }).catch(() => { if (mounted.current) setViewError('Unable to recenter. Try again.'); });
  }, [sdk, view, mapReady]);
  // Controller creation is a JS lifecycle event, not proof of native registration.
  useEffect(() => { following(); }, [following]);
  const active = state.phase === 'guiding';
  const minutes = Math.ceil((state.seconds ?? 0) / 60);
  const duration = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
  const eta = state.seconds === undefined ? 'Calculating arrival…' : `${duration} · ${new Date(state.arrivalAt ?? 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return <View style={StyleSheet.absoluteFill}>
    <View style={[StyleSheet.absoluteFill, { top: topInset }]}>
      <sdk.NavigationView style={{ flex: 1 }} headerEnabled footerEnabled={false} recenterButtonEnabled={false}
        reportIncidentButtonEnabled={false} tripProgressBarEnabled={false}
        navigationUIEnabledPreference={sdk.NavigationUIEnabledPreference.AUTOMATIC}
        navigationNightMode={dark ? sdk.NavigationNightMode.FORCE_NIGHT : sdk.NavigationNightMode.FORCE_DAY}
        mapPadding={{ top: 0, left: 0, right: 0, bottom: (footerHeight + footerBottom + 12) * (Platform.OS === 'android' ? PixelRatio.get() : 1) }}
        onNavigationViewControllerCreated={setView}
        onMapReady={() => setMapReady(true)} />
    </View>
    <View onLayout={event => setFooterHeight(event.nativeEvent.layout.height)} style={styles.footer}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: '#86efac', fontWeight: '700', fontSize: 17 }}>
          {state.phase === 'arrived' ? 'Arrived at delivery' : state.phase === 'stopping' ? 'Stopping navigation…' : state.rerouting ? 'Rerouting…' : eta}
        </Text>
        <Text numberOfLines={2} style={{ color: '#ffffff', fontSize: 12 }}>{state.target?.title}</Text>
        {active && state.meters !== undefined && <Text style={{ color: '#ffffff', fontSize: 12 }}>{(state.meters / 1000).toFixed(1)} km remaining</Text>}
        {(state.error || viewError) && <Text accessibilityLiveRegion="polite" style={{ color: '#fde68a', fontSize: 12 }}>{state.error || viewError}</Text>}
      </View>
      {active && <View style={{ gap: 8 }}>
        <Pressable style={styles.icon} onPress={() => void mute()} accessibilityRole="button" accessibilityLabel={state.muted ? 'Unmute guidance' : 'Mute guidance'}>
          <Feather name={state.muted ? 'volume-x' : 'volume-2'} size={20} color="#111111" />
        </Pressable>
        <Pressable style={styles.icon} onPress={following} disabled={!mapReady || !view} accessibilityState={{ disabled: !mapReady || !view }} accessibilityRole="button" accessibilityLabel="Recenter navigation"><Feather name="navigation" size={20} color="#111111" /></Pressable>
      </View>}
      <Pressable style={styles.exit} onPress={() => void exit()} accessibilityRole="button" accessibilityLabel="Exit navigation">
        {state.phase === 'stopping' && !state.error ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontWeight: '600' }}>Exit</Text>}
      </Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  footer: { backgroundColor: '#111111', position: 'absolute', bottom: footerBottom, left: 12, right: 12, borderRadius: 16, padding: 12, gap: 12, flexDirection: 'row', alignItems: 'center' },
  icon: { backgroundColor: '#ffffff', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#a1a1aa', borderRadius: 14 },
  exit: { minWidth: 64, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dc2626', borderRadius: 14 },
});
