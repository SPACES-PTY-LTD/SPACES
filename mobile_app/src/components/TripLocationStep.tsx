import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ImportLocation } from '@/src/lib/api';

type Endpoint = 'origin_location_id' | 'destination_location_id';
const address = (location: ImportLocation) => location.full_address ||
  [location.address_line_1, location.address_line_2, location.city, location.province, location.post_code, location.country].filter(Boolean).join(', ');
const routable = (location?: ImportLocation) => location?.latitude != null && location?.longitude != null;

export function TripLocationStep({ origin, end, busy, onChoose, onContinue }: {
  origin?: ImportLocation; end?: ImportLocation; busy: boolean;
  onChoose: (endpoint: Endpoint) => void; onContinue: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const ink = dark ? '#fafafa' : '#18181b';
  const muted = dark ? '#a1a1aa' : '#71717a';
  const surface = dark ? '#27272a' : '#f7f7f8';
  const border = dark ? '#3f3f46' : '#e4e4e7';
  const ready = routable(origin) && routable(end);
  return <>
    <View style={styles.intro}>
      <Text style={[styles.body, { color: muted }]}>Set your collection point and where you plan to finish.</Text>
    </View>
    <View style={[styles.route, { backgroundColor: surface }]}>
      {([
        ['origin_location_id', 'Run starting point', 'map-pin', origin],
        ['destination_location_id', 'Planned end location', 'flag', end],
      ] as const).map(([key, label, icon, location], index) => <View key={key} style={styles.endpoint}>
        <View style={styles.rail}>
          <View style={[styles.icon, { backgroundColor: dark ? '#502c32' : '#ffe4e6' }]}><Feather name={icon} size={18} color="#f54a4a" /></View>
          {index === 0 && <View style={[styles.connector, { backgroundColor: border }]} />}
        </View>
        <View style={styles.details}>
          <Text style={[styles.label, { color: muted }]}>{label}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${location ? 'Change' : 'Choose'} ${label.toLowerCase()}${location ? `, ${location.name}, ${address(location)}` : ''}`} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => onChoose(key)} style={[styles.location, { backgroundColor: dark ? '#18181b' : '#fff', borderColor: border, opacity: busy ? 0.6 : 1 }]}>
            <View style={styles.copy}>
              <Text style={[styles.name, { color: ink }]}>{location?.name || 'Choose location'}</Text>
              {location && <Text style={[styles.address, { color: muted }]}>{address(location) || 'Address unavailable'}</Text>}
              <Text style={styles.action}>{location ? 'Change location' : 'Search name or address'}</Text>
              {location && !routable(location) && <Text style={[styles.address, { color: muted }]}>Map position unavailable. Choose another location.</Text>}
            </View>
            <Feather name="chevron-right" size={18} color={muted} />
          </Pressable>
        </View>
      </View>)}
    </View>
    <View style={styles.hint}><Feather name="info" size={17} color={muted} /><Text style={[styles.hintText, { color: muted }]}>Shipment stops come between these points. Your planned end can differ from the last delivery.</Text></View>
    {!ready && <Text accessibilityLiveRegion="polite" style={[styles.address, { color: muted }]}>Choose both locations to review your shipments.</Text>}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready || busy, busy }} disabled={!ready || busy} onPress={onContinue} style={[styles.primary, { opacity: !ready || busy ? 0.5 : 1 }]}>
      {busy ? <ActivityIndicator color="#fff" /> : <Feather name="check-circle" size={18} color="#fff" />}
      <Text style={styles.primaryText}>{busy ? 'Checking shipments…' : 'Review shipments'}</Text>
      <Feather name="arrow-right" size={18} color="#fff" />
    </Pressable>
  </>;
}

const styles = StyleSheet.create({
  intro: { gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }, body: { fontSize: 14, lineHeight: 21 },
  route: { padding: 14, borderRadius: 20 }, endpoint: { flexDirection: 'row', gap: 12 },
  rail: { width: 34, alignItems: 'center' }, icon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  connector: { flex: 1, width: 2, marginVertical: 6 }, details: { flex: 1, gap: 8, paddingBottom: 16 },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '600', paddingTop: 7 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, padding: 14, minHeight: 76 },
  copy: { flex: 1, gap: 6 }, name: { fontSize: 15, lineHeight: 21, fontWeight: '600' }, address: { fontSize: 12, lineHeight: 18 },
  action: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#f54a4a' },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, hintText: { flex: 1, fontSize: 12, lineHeight: 18 },
  primary: { minHeight: 52, padding: 14, borderRadius: 14, backgroundColor: '#f54a4a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
