import { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import { Feather } from '@expo/vector-icons';
import { Text } from '@/component/ui/Text';
import { driverApi, type DriverShipment, type RunDirections } from '@/src/lib/api';
import { locationCoordinate } from './run-map-data';

export function nextDelivery(shipments: DriverShipment[]) {
  return shipments.find(s => !['delivered', 'failed', 'cancelled', 'returned'].includes(s.status));
}

export function deliveryNavigationUrl(shipment: DriverShipment) {
  const coordinate = locationCoordinate(shipment.dropoff_location);
  const address = shipment.dropoff_location?.full_address?.trim();
  const destination = coordinate ? `${coordinate.latitude},${coordinate.longitude}` : address;
  return destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving` : null;
}

export function deliveryEta(route: RunDirections | null, shipmentId: string, now = Date.now()) {
  const at = Date.parse(route?.calculated_at ?? '');
  if (route?.shipment_id !== shipmentId || route.status !== 'ready' || !Number.isFinite(route.duration_seconds)
    || route.duration_seconds! < 0 || !Number.isFinite(at) || at > now || now - at > 90_000) return null;
  return { minutes: Math.ceil(route.duration_seconds! / 60), arrival: new Date(at + route.duration_seconds! * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
}

export function NextDeliveryCard({ shipment, runId, token, topInset, onOpenShipment, onHeightChange }: {
  shipment: DriverShipment; runId: string; token: string; topInset: number; onOpenShipment: (id: string) => void; onHeightChange?: (height: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [result, setResult] = useState<{ key: string; route: RunDirections } | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const focused = useIsFocused();
  const key = JSON.stringify([token, runId, shipment.shipment_id, shipment.dropoff_location]);
  useEffect(() => {
    if (!focused) return;
    let cancelled = false, pending = false;
    const refresh = async () => {
      if (pending || AppState.currentState !== 'active') return;
      pending = true;
      await Promise.resolve();
      if (cancelled) { pending = false; return; }
      setClock(Date.now());
      try {
        const route = await driverApi.runDirections(token, runId, true);
        if (!cancelled) { setResult({ key, route }); setClock(Date.now()); }
      } catch { if (!cancelled) setResult({ key, route: { status: 'unavailable' } }); }
      finally { pending = false; }
    };
    void refresh();
    const timer = setInterval(() => { setClock(Date.now()); void refresh(); }, 60_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') { setClock(Date.now()); void refresh(); } });
    return () => { cancelled = true; clearInterval(timer); listener.remove(); };
  }, [focused, key, token, runId]);
  const eta = deliveryEta(result?.key === key ? result.route : null, shipment.shipment_id, clock);
  const originAt = result?.key === key ? Date.parse(result.route.origin_reported_at ?? '') : NaN;
  const originLabel = Number.isFinite(originAt) ? `From last truck location · ${new Date(originAt).toLocaleString()}` : 'From last truck location';
  const destination = shipment.dropoff_location?.name || shipment.dropoff_location?.full_address || 'Delivery destination unavailable';
  const reference = shipment.merchant_order_ref || shipment.delivery_note_number || shipment.shipment_id;
  const url = deliveryNavigationUrl(shipment);
  return <View pointerEvents="box-none" style={[styles.overlay, { top: topInset + 12 }]}>
    <View style={styles.card} onLayout={event => onHeightChange?.(event.nativeEvent.layout.height + 12)}>
      {collapsed ? <>
        <View style={styles.row}>
          <Text style={[styles.label, { flex: 1 }]}>NEXT DELIVERY</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.eta}>{eta ? `${eta.minutes} min` : 'ETA unavailable'}</Text>
            <Pressable onPress={() => setCollapsed(false)} accessibilityRole="button" accessibilityLabel="Expand next delivery" accessibilityState={{ expanded: false }} style={styles.toggle}><Feather name="chevron-down" size={20} color="#ffffff" /></Pressable>
          </View>
        </View>
        <Text style={styles.destination}>{destination}</Text>
      </> : <>
        <View style={styles.row}><Text style={[styles.label, { flex: 1 }]}>NEXT · {reference}</Text><Text style={styles.pill}>{eta ? `${eta.minutes} min · ${eta.arrival}` : 'ETA unavailable'}</Text></View>
        <Text style={styles.destination}>{destination}</Text>
        {eta && <Text style={styles.label}>{originLabel}</Text>}
        <View style={styles.row}>
          <Pressable accessibilityRole="button" onPress={() => onOpenShipment(shipment.shipment_id)} style={[styles.button, styles.outline]}><Text style={styles.buttonText}>View shipment</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !url }} disabled={!url} onPress={() => { if (url) void Linking.openURL(url).catch(() => setError('Unable to open maps. Please try again.')); }} style={[styles.button, { backgroundColor: '#15803d', opacity: url ? 1 : 0.5 }]}><Text style={styles.buttonText}>Navigate</Text></Pressable>
        </View>
        {error && <Text accessibilityRole="alert" style={styles.label}>{error}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Collapse next delivery" accessibilityState={{ expanded: true }} onPress={() => setCollapsed(true)} style={[styles.row, { minHeight: 44 }]}><Text style={[styles.label, { flex: 1 }]}>Collapse details</Text><Feather name="chevron-up" size={20} color="#ffffff" /></Pressable>
      </>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 20, right: 20 },
  card: { backgroundColor: '#111111', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, gap: 12, shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  label: { color: '#bdbdbd', fontSize: 11, lineHeight: 16 },
  destination: { color: '#ffffff', fontSize: 20, lineHeight: 26, fontWeight: '600' },
  pill: { color: '#111111', backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, fontWeight: '600' },
  eta: { color: '#ffffff', fontSize: 16, fontWeight: '600', flexShrink: 1 },
  toggle: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  button: { flex: 1, minWidth: 120, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  outline: { borderColor: '#ffffff59', borderWidth: 1 },
  buttonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});
