import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { useIsFocused } from 'expo-router/react-navigation';
import { Feather } from '@expo/vector-icons';
import { Text } from '@/component/ui/Text';
import { driverApi, type DriverShipment, type RunDirections } from '@/src/lib/api';
import { locationCoordinate } from './run-map-data';

const cardTransition = LinearTransition.duration(200).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);

export function nextDelivery(shipments: DriverShipment[]) {
  return shipments.find(s => !['delivered', 'failed', 'cancelled', 'returned'].includes(s.status));
}

export function deliveryEta(route: RunDirections | null, shipmentId: string, now = Date.now()) {
  const at = Date.parse(route?.calculated_at ?? '');
  if (route?.shipment_id !== shipmentId || route.status !== 'ready' || !Number.isFinite(route.duration_seconds)
    || route.duration_seconds! < 0 || !Number.isFinite(at) || at > now || now - at > 90_000) return null;
  return { minutes: Math.ceil(route.duration_seconds! / 60), arrival: new Date(at + route.duration_seconds! * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
}

export function NextDeliveryCard({ shipment, runId, token, topInset, onOpenShipment, onHeightChange, onNavigate }: {
  shipment: DriverShipment; runId: string; token: string; topInset: number; onOpenShipment: (id: string) => void; onHeightChange?: (height: number) => void;
  onNavigate: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [result, setResult] = useState<{ key: string; route: RunDirections } | null>(null);
  const [clock, setClock] = useState(() => Date.now());
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
  const canNavigate = !!locationCoordinate(shipment.dropoff_location);
  const Card = collapsed ? Pressable : View;
  return <View pointerEvents="box-none" style={[styles.overlay, { top: topInset + 12 }]}>
    <Animated.View layout={cardTransition} style={styles.shadow} onLayout={event => onHeightChange?.(event.nativeEvent.layout.height + 12)}>
      <Animated.View layout={cardTransition} style={styles.card}>
        {!collapsed && <View pointerEvents="none" style={styles.collapseJoin} />}
        <Card {...(collapsed ? {
          onPress: () => setCollapsed(false),
          accessibilityRole: 'button' as const,
          accessibilityLabel: 'Expand next delivery',
          accessibilityState: { expanded: false },
        } : {})} style={[styles.content, collapsed ? styles.compactCard : styles.expandedContent]}>
          {collapsed ? <>
            <View style={styles.row}>
              <Text style={[styles.label, { flex: 1 }]}>NEXT DELIVERY</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.eta}>{eta ? `${eta.minutes} min` : 'ETA unavailable'}</Text>
                <View style={styles.toggle}><Feather name="chevron-down" size={20} color="#ffffff" /></View>
              </View>
            </View>
            <Text style={styles.destination}>{destination}</Text>
          </> : <>
            <Pressable accessibilityRole="button" accessibilityLabel="Collapse next delivery details" accessibilityState={{ expanded: true }} onPress={() => setCollapsed(true)} style={styles.expandedDetails}>
              <View style={styles.row}><Text style={[styles.label, { flex: 1 }]}>NEXT · {reference}</Text><Text style={styles.pill}>{eta ? `${eta.minutes} min · ${eta.arrival}` : 'ETA unavailable'}</Text></View>
              <Text style={styles.destination}>{destination}</Text>
              {eta && <Text style={styles.label}>{originLabel}</Text>}
            </Pressable>
            <View style={styles.row}>
              <Pressable accessibilityRole="button" onPress={() => onOpenShipment(shipment.shipment_id)} style={[styles.button, styles.outline]}><Text style={styles.buttonText}>View shipment</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Navigate to delivery in app" accessibilityState={{ disabled: !canNavigate }} disabled={!canNavigate}
                onPress={() => { onNavigate(shipment.shipment_id); setCollapsed(true); }}
                style={[styles.button, { backgroundColor: '#15803d', opacity: canNavigate ? 1 : 0.5 }]}><Text style={styles.buttonText}>Navigate</Text></Pressable>
            </View>
            {!canNavigate && <Text style={styles.label}>Destination map coordinates are unavailable.</Text>}
          </>}
        </Card>
        {!collapsed && <Pressable accessibilityRole="button" accessibilityLabel="Collapse next delivery" accessibilityState={{ expanded: true }} onPress={() => setCollapsed(true)} style={styles.collapseTab}><Feather name="chevron-up" size={20} color="#ffffff" /></Pressable>}
      </Animated.View>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 20, right: 20 },
  shadow: { borderRadius: 20, shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  card: { borderRadius: 20, overflow: 'hidden' },
  content: { backgroundColor: '#111111', borderRadius: 20, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  expandedContent: { paddingBottom: 16 },
  collapseJoin: { position: 'absolute', right: 0, bottom: 44, width: 44, height: 20, backgroundColor: '#111111' },
  collapseTab: { alignSelf: 'flex-end', width: 44, height: 44, backgroundColor: '#111111', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, alignItems: 'center', justifyContent: 'center' },
  expandedDetails: { gap: 12, marginHorizontal: -16, marginTop: -10, paddingHorizontal: 16, paddingTop: 10 },
  compactCard: { paddingTop: 6, gap: 4 },
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
