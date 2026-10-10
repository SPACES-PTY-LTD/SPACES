import { Feather } from '@expo/vector-icons';
import { useCallback, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DriverDashboard } from '@/src/lib/api';

export function elapsedRunTime(startedAt: string | null | undefined, now: number) {
  const start = Date.parse(startedAt ?? '');
  if (!Number.isFinite(start)) return 'Time unavailable';
  const minutes = Math.floor(Math.max(0, now - start) / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}${hours === 1 ? 'hr' : 'hrs'} ${remainingMinutes}${remainingMinutes === 1 ? 'min' : 'mins'}`;
}

export function activeRunRoute(endpoints: DriverDashboard['trip_endpoints']) {
  const start = endpoints?.find(endpoint => endpoint.role === 'Run starting point')?.name?.trim();
  const end = endpoints?.find(endpoint => endpoint.role === 'Planned end location')?.name?.trim();
  return `From ${start || 'Start unavailable'} → ${end || 'End not set'}`;
}

export function ActiveRunDock({ startedAt, endpoints, showInfo, onShowTimeline, actions, onHeightChange }: {
  startedAt?: string | null;
  endpoints: DriverDashboard['trip_endpoints'];
  showInfo: boolean;
  onShowTimeline: () => void;
  actions: ReactNode;
  onHeightChange: (height: number) => void;
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => { if (timer !== undefined) clearInterval(timer); timer = undefined; };
    const refresh = () => {
      stop();
      setNow(Date.now());
      if (AppState.currentState === 'active' && Number.isFinite(Date.parse(startedAt ?? ''))) {
        timer = setInterval(() => setNow(Date.now()), 1000);
      }
    };
    refresh();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') refresh(); else stop();
    });
    return () => { stop(); listener.remove(); };
  }, [startedAt]));
  const ink = dark ? '#ffffff' : '#111111';
  const line = dark ? '#303036' : '#dedee1';
  return <View style={[styles.dock, { backgroundColor: dark ? '#18181b' : '#ffffff', borderColor: line }]}
    onLayout={event => onHeightChange(event.nativeEvent.layout.height)}>
    <View style={styles.row}>
      <Pressable style={styles.summary} onPress={onShowTimeline} accessibilityRole="button"
        accessibilityLabel="Show run timeline from elapsed time" accessibilityHint="Expands the dashboard bottom sheet to show run details">
        <Text style={[styles.label, { color: dark ? '#86efac' : '#15803d' }]}>Run active for:</Text>
        <Text accessibilityLiveRegion="none" style={[styles.elapsed, { color: ink }]}>{elapsedRunTime(startedAt, now)}</Text>
      </Pressable>
      {showInfo && <Pressable accessibilityRole="button" accessibilityLabel="Show run timeline"
        accessibilityHint="Expands the dashboard bottom sheet to show run details"
        onPress={onShowTimeline} style={[styles.info, { borderColor: dark ? line : '#dbdbe0' }]}>
        <Feather name="info" size={20} color={ink} />
      </Pressable>}
      {actions}
    </View>
    <Pressable onPress={onShowTimeline} accessibilityRole="button" accessibilityLabel="Show run timeline from route"
      accessibilityHint="Expands the dashboard bottom sheet to show run details" hitSlop={{ top: 6, bottom: 6 }}>
      <Text numberOfLines={2} style={[styles.route, { color: dark ? '#a1a1aa' : '#71717a' }]}>{activeRunRoute(endpoints)}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  dock: { paddingHorizontal: 16, paddingVertical: 14, gap: 8, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summary: { flex: 1, minWidth: 0, gap: 4 },
  label: { fontSize: 11, lineHeight: 13.2, fontWeight: '600' },
  elapsed: { fontSize: 24, lineHeight: 28.8, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1 },
  info: { width: 44, height: 44, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  route: { fontSize: 12, lineHeight: 16 },
});
