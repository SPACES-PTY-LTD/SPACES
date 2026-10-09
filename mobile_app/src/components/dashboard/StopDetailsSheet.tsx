import { Feather } from '@expo/vector-icons';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomSheet } from '@/component/ui/BottomSheet';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { RunStop } from './RunTimeline';
import { StopLocationMap } from './StopLocationMap';
import { stopVisitDuration } from './stop-visit-time';
import { stopCoordinate } from './run-map-data';
import type { DriverDashboard, DriverShipment } from '@/src/lib/api';
import { shipmentsAtStop, stopShipmentStatus } from './stop-shipments';

function eventTime(value: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return 'Time not recorded';
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

/** Location details and shipment actions for recorded visits and planned endpoints. */
export function StopDetailsSheet({ stop, onDismiss, shipments = [], endpoints = [], onOpenShipment }: { stop: RunStop | null; onDismiss: () => void; shipments?: DriverShipment[]; endpoints?: DriverDashboard['trip_endpoints']; onOpenShipment: (shipmentId: string) => void }) {
  const modalRef = useRef<BottomSheetModal>(null);
  const pendingShipment = useRef<string | null>(null);
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
  const related = shipmentsAtStop(stop, shipments);
  const hasResolvedCoordinate = !!coordinate;
  useEffect(() => {
    if (__DEV__ && stop) console.info('[StopDetailsSheet] coordinate payload', {
      hasTimelineFields: stop.latitude !== undefined || stop.longitude !== undefined,
      hasResolvedCoordinate,
      linkedShipments: stop.shipments?.length ?? 0,
    });
  }, [stop, hasResolvedCoordinate]);
  function dismiss() {
    const shipmentId = pendingShipment.current;
    pendingShipment.current = null;
    onDismiss();
    // Navigate after the modal's native overlay has detached.
    if (shipmentId) onOpenShipment(shipmentId);
  }
  return <BottomSheet modalRef={modalRef} title={stop?.kind || 'Stop'} accessibilityLabel="Location details" showHandle={false} scrollable onDismiss={dismiss}>
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
      {!stop.planned && stop.kind !== 'Speeding' ? <View style={[styles.visit, { backgroundColor: surface }]}>
        <View style={styles.visitHeader}>
          <Text accessibilityRole="header" style={[styles.visitTitle, { color: ink }]}>Time at location</Text>
          <Text style={[styles.label, { color: muted }]}>Local time</Text>
        </View>
        {([
          { label: 'Entered at', icon: 'log-in', value: eventTime(stop.occurred_at) },
          { label: 'Exited at', icon: 'log-out', value: stop.exited_at ? eventTime(stop.exited_at) : 'Exit not recorded' },
          { label: 'Total time at location', icon: 'clock', value: stopVisitDuration(stop.occurred_at, stop.exited_at) || 'Not available', total: true },
        ] as const).map((item, index) => <View key={item.label} style={[styles.visitRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: dark ? '#52525b' : '#dedee3', paddingTop: 8 }]}>
          <View style={[styles.timeIcon, { backgroundColor: dark ? '#3f3f46' : '#e9e9ed' }]}><Feather name={item.icon} size={17} color={muted} /></View>
          <View style={styles.visitText}>
            <Text style={[styles.label, { color: muted }]}>{item.label}</Text>
            <Text style={['total' in item ? styles.duration : styles.value, { color: ink }]}>{item.value}</Text>
          </View>
        </View>)}
      </View> : <View style={[styles.metadata, { backgroundColor: surface }]}>
        <Feather name={stop.planned ? 'flag' : 'clock'} size={18} color={muted} />
        <View style={styles.metadataText}>
          <Text style={[styles.label, { color: muted }]}>{stop.planned ? 'Planned endpoint' : 'Recorded at · local time'}</Text>
          <Text style={[styles.value, { color: ink }]}>{stop.planned ? 'Not visited yet' : eventTime(stop.occurred_at)}</Text>
        </View>
      </View>}
      {stop.kind === 'Speeding' && <View style={[styles.metadata, { backgroundColor: surface }]}>
        <Feather name="alert-triangle" size={18} color={dark ? '#fde68a' : '#b45309'} />
        <View style={styles.metadataText}>
          <Text style={[styles.value, { color: ink }]}>{stop.speed_kph != null ? `${stop.speed_kph} km/h` : 'Speed not recorded'}</Text>
          <Text style={[styles.label, { color: muted }]}>{stop.speed_limit_kph != null ? `Speed limit · ${stop.speed_limit_kph} km/h` : 'Speed limit not recorded'}</Text>
        </View>
      </View>}
      {stop.kind !== 'Speeding' && <View style={styles.shipmentSections}>
        {([
          { title: 'Deliveries', icon: 'package', items: related.deliveries },
          { title: 'Collections', icon: 'truck', items: related.collections },
        ] as const).filter(section => section.items.length > 0).map(section => <View key={section.title} style={styles.shipmentSections}>
          <Text accessibilityRole="header" style={[styles.visitTitle, { color: ink }]}>{section.title} · {section.items.length}</Text>
          {section.items.map(shipment => {
            const reference = shipment.merchant_order_ref || shipment.shipment_id;
            return <Pressable key={shipment.shipment_id} accessibilityRole="button" accessibilityLabel={`Open shipment ${reference}`} accessibilityHint="Opens the shipment details."
              onPress={() => { pendingShipment.current = shipment.shipment_id; modalRef.current?.dismiss(); }}
              style={[styles.shipmentCard, { backgroundColor: surface }]}>
              <View style={styles.shipmentIdentity}>
                <Feather name={section.icon} size={18} color={muted} />
                <View style={styles.visitText}>
                  <Text style={[styles.value, { color: ink, fontWeight: '600' }]}>{reference}</Text>
                  <Text style={[styles.label, { color: muted }]}>{stopShipmentStatus(shipment)}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={muted} />
              </View>
            </Pressable>;
          })}
        </View>)}
        {!related.deliveries.length && !related.collections.length && <Text style={[styles.caption, { color: muted }]}>No shipments linked to this location in this run.</Text>}
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
  visit: { borderRadius: 16, padding: 12, gap: 8 },
  visitHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  visitTitle: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  visitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  visitText: { flex: 1, gap: 1 },
  timeIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  duration: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  metadataText: { flex: 1, gap: 5 },
  label: { fontSize: 12, lineHeight: 18 },
  value: { fontSize: 14, lineHeight: 21, fontWeight: '500' },
  shipmentSections: { gap: 10 },
  shipmentCard: { borderRadius: 14, padding: 12, minHeight: 64 },
  shipmentIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
