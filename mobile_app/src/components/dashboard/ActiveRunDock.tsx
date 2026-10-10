import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DriverDashboard } from '@/src/lib/api';

export function elapsedRunTime(startedAt: string | null | undefined, now: number) {
  const start = Date.parse(startedAt ?? '');
  if (!Number.isFinite(start)) return 'Time unavailable';
  const seconds = Math.floor(Math.max(0, now - start) / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}

export function activeRunRoute(endpoints: DriverDashboard['trip_endpoints']) {
  const start = endpoints?.find(endpoint => endpoint.role === 'Run starting point')?.name?.trim();
  const end = endpoints?.find(endpoint => endpoint.role === 'Planned end location')?.name?.trim();
  return `From ${start || 'Start unavailable'} → ${end || 'End not set'}`;
}

export function ActiveRunDock({ startedAt, endpoints, onActions, onHeightChange }: {
  startedAt?: string | null;
  endpoints: DriverDashboard['trip_endpoints'];
  onActions: () => void;
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
      <View style={styles.summary}>
        <Text style={[styles.label, { color: dark ? '#86efac' : '#15803d' }]}>RUN ACTIVE</Text>
        <Text accessibilityLiveRegion="none" style={[styles.elapsed, { color: ink }]}>{elapsedRunTime(startedAt, now)}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Run actions" onPress={onActions}
        style={[styles.actions, { borderColor: dark ? line : '#dbdbe0' }]}>
        <Text style={[styles.actionText, { color: ink }]}>Actions</Text>
      </Pressable>
    </View>
    <Text numberOfLines={2} style={[styles.route, { color: dark ? '#a1a1aa' : '#71717a' }]}>{activeRunRoute(endpoints)}</Text>
  </View>;
}

const styles = StyleSheet.create({
  dock: { paddingHorizontal: 16, paddingVertical: 14, gap: 8, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summary: { flex: 1, minWidth: 0, gap: 4 },
  label: { fontSize: 11, lineHeight: 13.2, fontWeight: '600' },
  elapsed: { fontSize: 24, lineHeight: 28.8, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1 },
  actions: { width: 100, minHeight: 44, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  actionText: { fontSize: 16, fontWeight: '600' },
  route: { fontSize: 12, lineHeight: 16 },
});
