import { Feather } from '@expo/vector-icons';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet } from '@/component/ui/BottomSheet';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { RunStop } from './RunTimeline';
import { StopLocationMap } from './StopLocationMap';
import { stopCoordinate } from './run-map-data';
import type { DriverDashboard, DriverShipment } from '@/src/lib/api';

function eventTime(value: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return 'Time not recorded';
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

/** Read-only details for recorded visits, events and planned timeline endpoints. */
export function StopDetailsSheet({ stop, onDismiss, shipments = [], endpoints = [] }: { stop: RunStop | null; onDismiss: () => void; shipments?: DriverShipment[]; endpoints?: DriverDashboard['trip_endpoints'] }) {
  const modalRef = useRef<BottomSheetModal>(null);
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const ink = dark ? '#fafafa' : '#18181b';
  const muted = dark ? '#a1a1aa' : '#71717a';
  const surface = dark ? '#303036' : '#f4f4f5';
  useEffect(() => {
    if (stop) modalRef.current?.present();
    else modalRef.current?.dismiss();
  }, [stop]);
  const coordinate = stopCoordinate(stop, shipments, endpoints);
  const hasResolvedCoordinate = !!coordinate;
  useEffect(() => {
    if (__DEV__ && stop) console.info('[StopDetailsSheet] coordinate payload', {
      hasTimelineFields: stop.latitude !== undefined || stop.longitude !== undefined,
      hasResolvedCoordinate,
      linkedShipments: stop.shipments?.length ?? 0,
    });
  }, [stop, hasResolvedCoordinate]);
  return <BottomSheet modalRef={modalRef} title={stop?.kind || 'Stop'} accessibilityLabel="Location details" scrollable onDismiss={onDismiss}>
    {stop && <>
      <View style={styles.identity}>
        <Text accessibilityRole="header" style={[styles.name, { color: ink }]}>{stop.name || 'Location not provided'}</Text>
        <Text selectable style={[styles.address, { color: muted }]}>{stop.address || 'Address not provided'}</Text>
      </View>
      <View style={[styles.map, { backgroundColor: surface, borderColor: dark ? '#3f3f46' : '#e4e4e7' }]}>
        {coordinate ? <StopLocationMap coordinate={coordinate} name={stop.name} dark={dark} /> : <View style={styles.unavailable}>
          <Feather name="map-pin" size={24} color={muted} />
          <Text style={{ color: ink, fontWeight: '600' }}>Map coordinates unavailable</Text>
          <Text style={[styles.caption, { color: muted }]}>This stop’s details don’t include a usable map position yet.</Text>
        </View>}
      </View>
      {coordinate && <Text style={[styles.caption, { color: muted }]}>{stop.kind === 'Speeding' ? 'Recorded event position' : 'Stop location'}</Text>}
      <View style={[styles.metadata, { backgroundColor: surface }]}>
        <Feather name={stop.planned ? 'flag' : 'clock'} size={18} color={muted} />
        <View style={styles.metadataText}>
          <Text style={[styles.label, { color: muted }]}>{stop.planned ? 'Planned endpoint' : 'Recorded at · local time'}</Text>
          <Text style={[styles.value, { color: ink }]}>{stop.planned ? 'Not visited yet' : eventTime(stop.occurred_at)}</Text>
          {!!stop.exited_at && <Text style={[styles.value, { color: muted }]}>Left {eventTime(stop.exited_at)}</Text>}
        </View>
      </View>
      {stop.kind === 'Speeding' && <View style={[styles.metadata, { backgroundColor: surface }]}>
        <Feather name="alert-triangle" size={18} color={dark ? '#fca5a5' : '#b91c1c'} />
        <View style={styles.metadataText}>
          <Text style={[styles.value, { color: ink }]}>{stop.speed_kph != null ? `${stop.speed_kph} km/h` : 'Speed not recorded'}</Text>
          <Text style={[styles.label, { color: muted }]}>{stop.speed_limit_kph != null ? `Speed limit · ${stop.speed_limit_kph} km/h` : 'Speed limit not recorded'}</Text>
        </View>
      </View>}
    </>}
  </BottomSheet>;
}

const styles = StyleSheet.create({
  identity: { gap: 8 },
  name: { fontSize: 24, lineHeight: 31, fontWeight: '700' },
  address: { fontSize: 14, lineHeight: 21 },
  map: { height: 200, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  caption: { fontSize: 12, lineHeight: 18 },
  metadata: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, padding: 16 },
  metadataText: { flex: 1, gap: 5 },
  label: { fontSize: 12, lineHeight: 18 },
  value: { fontSize: 14, lineHeight: 21, fontWeight: '500' },
});
