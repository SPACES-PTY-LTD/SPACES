import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ImportResult } from '@/src/lib/api';

export function ImportCompletion({ result }: { result: ImportResult }) {
  const dark = useColorScheme().colorScheme === 'dark';
  const ink = dark ? '#fafafa' : '#18181b';
  const muted = dark ? '#a1a1aa' : '#71717a';
  const accent = dark ? '#86efac' : '#15803d';
  const counts = [
    { label: 'Created', count: result.created.length },
    { label: 'Assigned', count: result.attached.length },
    { label: 'Skipped', count: result.skipped.length },
    { label: 'Already delivered', count: result.delivered?.length ?? 0 },
    { label: 'Unassigned', count: result.unassigned.length },
  ].filter(({ count }) => count > 0);

  return <View style={styles.content}>
    <View style={styles.confirmation}>
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.badge, { backgroundColor: dark ? '#142e20' : '#f0fdf4' }]}>
        <Feather name="check" size={36} color={accent} />
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>Delivery note processed</Text>
      <Text style={[styles.subtitle, { color: muted }]}>Your upload is complete.</Text>
    </View>
    {counts.length > 0 && <View style={styles.results}>
      {counts.map(({ label, count }) => <View key={label} accessible accessibilityLabel={`${count} ${label.toLowerCase()}`} style={[styles.tile, { backgroundColor: dark ? '#27272a' : '#f5f5f8' }]}>
        <Text style={[styles.count, { color: ink }]}>{count}</Text>
        <Text style={[styles.label, { color: muted }]}>{label}</Text>
      </View>)}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: 24, paddingTop: 8, paddingBottom: 8 },
  confirmation: { alignItems: 'center', gap: 8 },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  results: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexGrow: 1, flexBasis: '45%', padding: 16, borderRadius: 16, gap: 4, alignItems: 'center' },
  count: { fontSize: 26, lineHeight: 32, fontWeight: '700', fontVariant: ['tabular-nums'], textAlign: 'center' },
  label: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
