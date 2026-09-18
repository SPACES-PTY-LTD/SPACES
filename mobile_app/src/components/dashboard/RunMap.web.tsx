import { StyleSheet, View } from 'react-native';
import { Text } from '@/component/ui/Text';
import type { RunMapProps } from './RunMap';

export function RunMap(_props: RunMapProps) {
  return <View style={styles.map}><Text style={styles.title}>Your run map</Text><Text style={styles.body}>Open the mobile app to view shipment locations on the map.</Text></View>;
}
const styles = StyleSheet.create({
  map: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: '#eeeee8' },
  title: { color: '#111111', fontSize: 18, fontWeight: '700' },
  body: { color: '#71717a', fontSize: 14, textAlign: 'center', marginTop: 8 },
});
