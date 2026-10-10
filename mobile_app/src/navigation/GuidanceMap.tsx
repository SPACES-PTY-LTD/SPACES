import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, PixelRatio, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { NavigationViewController } from '@googlemaps/react-native-navigation-sdk';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGuidance } from './GuidanceProvider';
import { navigationSdk } from './navigation-sdk';

export function GuidanceMap({ topInset }: { topInset: number }) {
  const { state, exit, mute } = useGuidance();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark', ink = dark ? '#ffffff' : '#111111';
  const view = useRef<NavigationViewController | null>(null);
  const [footerHeight, setFooterHeight] = useState(144);
  const [viewError, setViewError] = useState<string>();
  const sdk = navigationSdk!;
  const following = useCallback(() => {
    setViewError(undefined);
    void view.current?.setFollowingPerspective(sdk.CameraPerspective.TILTED).catch(() => setViewError('Unable to recenter. Try again.'));
  }, [sdk]);
  const active = state.phase === 'guiding';
  const eta = state.seconds === undefined ? 'Calculating arrival…' : `${Math.ceil(state.seconds / 60)} min · ${new Date(state.arrivalAt ?? 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return <View style={StyleSheet.absoluteFill}>
    <View style={[StyleSheet.absoluteFill, { top: topInset }]}>
      <sdk.NavigationView style={{ flex: 1 }} headerEnabled footerEnabled={false} recenterButtonEnabled={false}
        reportIncidentButtonEnabled={false} tripProgressBarEnabled={false}
        navigationNightMode={dark ? sdk.NavigationNightMode.FORCE_NIGHT : sdk.NavigationNightMode.FORCE_DAY}
        mapPadding={{ top: 0, left: 0, right: 0, bottom: (footerHeight + 24) * (Platform.OS === 'android' ? PixelRatio.get() : 1) }}
        onNavigationViewControllerCreated={controller => {
          view.current = controller;
          void controller.setNavigationUIEnabled(true).then(following).catch(() => setViewError('Navigation map unavailable. Exit and retry.'));
        }} />
    </View>
    <View onLayout={event => setFooterHeight(event.nativeEvent.layout.height)} style={[styles.footer, { backgroundColor: dark ? '#18181b' : '#ffffff' }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: dark ? '#86efac' : '#15803d', fontWeight: '700', fontSize: 17 }}>
          {state.phase === 'arrived' ? 'Arrived at delivery' : state.phase === 'stopping' ? 'Stopping navigation…' : state.rerouting ? 'Rerouting…' : eta}
        </Text>
        <Text numberOfLines={2} style={{ color: ink, fontSize: 12 }}>{state.target?.title}</Text>
        {active && state.meters !== undefined && <Text style={{ color: ink, fontSize: 12 }}>{(state.meters / 1000).toFixed(1)} km remaining</Text>}
        {(state.error || viewError) && <Text accessibilityLiveRegion="polite" style={{ color: dark ? '#fde68a' : '#92400e', fontSize: 12 }}>{state.error || viewError}</Text>}
      </View>
      {active && <View style={{ gap: 8 }}>
        <Pressable style={styles.icon} onPress={() => void mute()} accessibilityRole="button" accessibilityLabel={state.muted ? 'Unmute guidance' : 'Mute guidance'}>
          <Feather name={state.muted ? 'volume-x' : 'volume-2'} size={20} color={ink} />
        </Pressable>
        <Pressable style={styles.icon} onPress={following} accessibilityRole="button" accessibilityLabel="Recenter navigation"><Feather name="navigation" size={20} color={ink} /></Pressable>
      </View>}
      <Pressable style={styles.exit} onPress={() => void exit()} accessibilityRole="button" accessibilityLabel="Exit navigation">
        {state.phase === 'stopping' && !state.error ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontWeight: '600' }}>Exit</Text>}
      </Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  footer: { position: 'absolute', bottom: 12, left: 12, right: 12, borderRadius: 16, padding: 12, gap: 12, flexDirection: 'row', alignItems: 'center' },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#a1a1aa', borderRadius: 14 },
  exit: { minWidth: 64, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dc2626', borderRadius: 14 },
});
