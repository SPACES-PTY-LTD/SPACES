import { useIsFocused } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { ActionSheet, type ActionSheetRef } from '@/component/ui/ActionSheet';
import { Text } from '@/component/ui/Text';
import { driverApi, type RunPosition, type RunDirections, type DriverShipment } from '@/src/lib/api';
import { useRecordedRunTrack } from './useRecordedRunTrack';
import { runMapStyle } from './run-map-style';
import { groupRunMapStops, runMapStops } from './run-map-data';

export type RunMapProps = {
  shipments: DriverShipment[];
  endpoints?: { role: string; name: string; latitude: number | null; longitude: number | null; address?: string }[];
  runId?: string;
  token?: string;
  topInset: number;
  onOpenShipment: (id: string) => void;
};

/** Road geometry is fetched separately so routing never blocks the dashboard. */
export function RunMap({ shipments, endpoints, runId, token, topInset, onOpenShipment }: RunMapProps) {
  const endpointPins = useMemo(() => (endpoints || []).filter(p => p.latitude != null && p.longitude != null).map(p => ({ ...p, coordinate: { latitude: p.latitude!, longitude: p.longitude! } })), [endpoints]);
  const ref = useRef<MapView>(null);
  const actions = useRef<ActionSheetRef>(null);
  const [routeRetry, setRouteRetry] = useState(0);
  const [showRouteInfo, setShowRouteInfo] = useState(false);
  const [ready, setReady] = useState(false);
  const focused = useIsFocused();
  const [mode, setMode] = useState<'planned' | 'recorded'>('planned');
  const recorded = useRecordedRunTrack(runId, token, focused && mode === 'recorded');
  const recordedPoints = useMemo(() => recorded.track?.segments.flat() ?? [], [recorded.track]);
  const [positionResult, setPositionResult] = useState<{ runId: string; value: RunPosition } | null>(null);
  const [positionFailed, setPositionFailed] = useState(false);
  const position = positionResult && positionResult.runId === runId ? positionResult.value : null;
  const truckLatitude = position?.coordinate?.latitude;
  const truckLongitude = position?.coordinate?.longitude;
  const truck = useMemo(() => truckLatitude != null && truckLongitude != null ? { latitude: truckLatitude, longitude: truckLongitude } : null, [truckLatitude, truckLongitude]);
  useEffect(() => {
    if (!focused || !runId || !token) return;
    let cancelled = false;
    let pending = false;
    const refresh = async () => {
      if (pending || AppState.currentState !== 'active') return;
      pending = true;
      try {
        const value = await driverApi.runPosition(token, runId);
        if (!cancelled) { setPositionResult({ runId, value }); setPositionFailed(false); }
      } catch { if (!cancelled) setPositionFailed(true); }
      finally { pending = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { cancelled = true; clearInterval(timer); subscription.remove(); };
  }, [focused, runId, token]);
  const stops = useMemo(() => runMapStops(shipments), [shipments]);
  const groups = useMemo(() => groupRunMapStops(stops), [stops]);
  const routeKey = JSON.stringify([runId, endpointPins, stops.map(stop => [stop.shipment.shipment_id, stop.coordinate])]);
  const [result, setResult] = useState<{ key: string; route: RunDirections } | null>(null);
  const route = result?.key === routeKey ? result.route : null;
  useEffect(() => {
    let cancelled = false;
    if (mode !== 'planned' || !runId || !token || (!stops.length && !endpointPins.length)) return;
    driverApi.runDirections(token, runId).then(route => {
      if (!cancelled) setResult({ key: routeKey, route });
    }).catch(() => {
      if (!cancelled) setResult({ key: routeKey, route: { status: 'unavailable' } });
    });
    return () => { cancelled = true; };
  }, [runId, token, routeKey, stops.length, endpointPins.length, routeRetry, mode]);
  const road = route?.status === 'ready' ? route.coordinates : undefined;
  const fit = useCallback(() => {
    const coordinates = mode === 'recorded' ? [...recordedPoints, ...(truck ? [truck] : [])] : [...(road ?? []), ...stops.map(stop => stop.coordinate), ...endpointPins.map(p => p.coordinate), ...(truck ? [truck] : [])];
    if (!ready || !coordinates.length) return;
    if (coordinates.length === 1) {
      ref.current?.animateToRegion({ ...coordinates[0], latitudeDelta: 0.025, longitudeDelta: 0.025 }, 250);
    } else {
      ref.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: topInset + (mode === 'recorded' ? 180 : 65), right: 40, bottom: 105, left: 40 }, animated: false,
      });
    }
  }, [ready, stops, topInset, road, truck, endpointPins, mode, recordedPoints]);
  useEffect(fit, [fit]);
  const missing = shipments.length - stops.length;
  return <View style={styles.container}>
    <MapView provider={PROVIDER_GOOGLE} customMapStyle={runMapStyle} mapPadding={{ top: 0, right: 0, bottom: 45, left: 0 }} ref={ref} style={StyleSheet.absoluteFill} onMapReady={() => setReady(true)} onLayout={fit}
      initialRegion={{ latitude: 0, longitude: 0, latitudeDelta: 100, longitudeDelta: 100 }}
      userInterfaceStyle="light" showsPointsOfInterest={false} showsCompass={false} rotateEnabled={false} pitchEnabled={false}
      accessibilityLabel="Current run shipment locations">
      {mode === 'planned' && road && missing === 0 ? <Polyline coordinates={road} strokeColor="#f54a4a" strokeWidth={4} /> : null}
      {mode === 'planned' && endpointPins.map(p => <Marker key={p.role} coordinate={p.coordinate} title={`${p.role} · ${p.name}`} description={p.address} pinColor={p.role === 'Run starting point' ? '#2563eb' : '#71717a'} />)}
      {truck ? <Marker coordinate={truck} zIndex={100} title={position?.plate_number ? `Truck · ${position.plate_number}` : 'Your truck'}
        description={position?.updated_at ? `Last reported ${new Date(position.updated_at).toLocaleString()}` : 'Last reported position · update time unknown'}>
        <View style={styles.truckMarker}><Feather name="truck" size={21} color="#ffffff" /></View>
      </Marker> : null}
      {mode === 'planned' && groups.map(group => {
        const numbers = group.stops.map(stop => stop.number).join(' · ');
        const allDelivered = group.stops.every(stop => stop.shipment.status === 'delivered');
        const open = () => {
          if (group.stops.length === 1) return onOpenShipment(group.stops[0].shipment.shipment_id);
          actions.current?.present({ title: 'Shipments at this stop', actions: group.stops.map(stop => ({
            id: stop.shipment.shipment_id, label: `${stop.number}. ${stop.shipment.merchant_order_ref || 'Shipment'}`,
            onPress: () => onOpenShipment(stop.shipment.shipment_id),
          })) });
        };
        return <Marker key={group.stops.map(stop => `${stop.shipment.shipment_id}-${stop.shipment.status}`).join(',')} coordinate={group.coordinate}
          title={`Stop ${numbers}`} description={group.stops.length === 1 ? 'Open shipment' : 'View shipments at this location'}
          onPress={open}>
          <View style={[styles.marker, { backgroundColor: allDelivered ? '#24753a' : '#f54a4a' }]}>
            <Text style={styles.number}>{numbers}</Text>
          </View>
        </Marker>;
      })}
      {mode === 'recorded' && recorded.track?.segments.map((segment, index) => segment.length > 1
        ? <Polyline key={index} coordinates={segment} strokeColor="#2563eb" strokeWidth={4} />
        : segment[0] ? <Marker key={index} coordinate={segment[0]} title="Recorded position" /> : null)}
      {mode === 'recorded' && recorded.track?.stops.map((stop, index) => <Marker key={index} coordinate={stop} title="Stationary"
        description={`${new Date(stop.first_seen_at).toLocaleString()} – ${new Date(stop.last_seen_at).toLocaleString()}`} pinColor="#71717a" />)}
    </MapView>
    {runId ? <View style={[styles.modeToggle, { top: topInset + 12 }]}>
      {(['planned', 'recorded'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: mode === value }}
        onPress={() => setMode(value)} style={[styles.modeButton, mode === value && { backgroundColor: '#27272a' }]}>
        <Text style={{ color: mode === value ? '#ffffff' : '#27272a', fontSize: 13, fontWeight: '600' }}>{value === 'planned' ? 'Planned' : 'Recorded'}</Text>
      </Pressable>)}
    </View> : null}
    {mode === 'recorded' && runId ? <View style={[styles.recordedStatus, { top: topInset + 60 }]}>
      <Text style={styles.captionText}>{recorded.error ? (recorded.track ? 'Showing previous data. ' : '') + recorded.error
        : !recorded.track ? 'Loading recorded GPS…'
        : recorded.track.status === 'disabled' ? 'Recorded route display is not enabled.'
        : recorded.track.status === 'empty' ? 'No GPS history recorded yet.'
        : recorded.track.source === 'limited_history' ? 'Limited historical data · activity events only'
        : recorded.track.active && recorded.track.latest_observed_at && Date.now() - Date.parse(recorded.track.latest_observed_at) > 300000 ? 'Recorded GPS · tracking is stale'
        : recorded.track.coverage.partial ? 'Recorded GPS · partial route coverage' : 'Recorded GPS · gaps indicate missing tracking'}</Text>
      {recorded.track?.coverage.from && <Text style={styles.captionText}>{new Date(recorded.track.coverage.from).toLocaleString()} – {new Date(recorded.track.coverage.to!).toLocaleString()}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Pressable accessibilityRole="button" onPress={recorded.retry} style={{ padding: 8 }}><Text style={styles.captionText}>Refresh</Text></Pressable>
        {recorded.track?.coverage.next_before && <Pressable accessibilityRole="button" onPress={() => recorded.setBefore(recorded.track!.coverage.next_before!)} style={{ padding: 8 }}><Text style={styles.captionText}>Earlier route</Text></Pressable>}
        {recorded.before && <Pressable accessibilityRole="button" onPress={() => recorded.setBefore(undefined)} style={{ padding: 8 }}><Text style={styles.captionText}>Latest route</Text></Pressable>}
      </View>
    </View> : null}
    {mode === 'planned' && runId && !truck ? <View pointerEvents="none" style={[styles.truckStatus, { top: topInset + 60 }]}>
      <Feather name="truck" size={18} color="#2563eb" />
      <Text style={styles.truckStatusText}>{positionFailed ? 'Truck location unavailable' : position ? 'Truck location not reported yet' : 'Locating truck…'}</Text>
    </View> : null}
    <ActionSheet ref={actions} />
    {mode === 'planned' && !stops.length && !truck && !endpointPins.length ? <View pointerEvents="none" style={styles.empty}>
      <Text style={styles.emptyTitle}>{shipments.length ? 'Run locations not mapped yet' : 'Your run map'}</Text>
      <Text style={styles.emptyText}>{shipments.length ? 'Shipment locations will appear when their map coordinates are available.' : 'Assigned shipment locations will appear here.'}</Text>
    </View> : mode === 'planned' && showRouteInfo ? <View style={styles.caption}>
      <Text style={styles.captionText}>{!stops.length && truck ? 'Last reported truck position' : missing ? `${stops.length} of ${shipments.length} shipment locations mapped` : road ? `Google route · ${(route!.distance_meters! / 1000).toFixed(1)} km · ~${Math.ceil(route!.duration_seconds! / 60)} min` : groups.length === 1 ? 'Shipment stop' : !route ? 'Finding road directions…' : 'Road directions unavailable'}</Text>
      {route?.status === 'unavailable' && <Pressable accessibilityRole="button" onPress={() => { setResult(null); setRouteRetry(v => v + 1); }} style={{ padding: 8 }}><Text style={styles.captionText}>Retry directions</Text></Pressable>}
    </View> : null}
    {mode === 'planned' && (stops.length || truck || endpointPins.length) ? <Pressable style={styles.infoButton} onPress={() => setShowRouteInfo(value => !value)}
      accessibilityRole="button" accessibilityLabel={showRouteInfo ? 'Hide route information' : 'Show route information'}
      accessibilityState={{ expanded: showRouteInfo }}>
      <Feather name="info" size={20} color={showRouteInfo ? '#f54a4a' : '#52525b'} />
    </Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  modeToggle: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', padding: 4, borderRadius: 24, backgroundColor: '#ffffff' },
  modeButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  recordedStatus: { position: 'absolute', alignSelf: 'center', maxWidth: '90%', backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  container: { flex: 1, backgroundColor: '#eeeee8' },
  truckMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb', borderWidth: 3, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  truckStatus: { position: 'absolute', alignSelf: 'center', maxWidth: '92%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffffff' },
  truckStatusText: { fontSize: 11, color: '#374151', flexShrink: 1 },
  marker: { minWidth: 30, paddingHorizontal: 6, height: 30, borderRadius: 15, borderWidth: 3, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  number: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  empty: { position: 'absolute', top: '42%', alignSelf: 'center', width: '82%', padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  emptyTitle: { color: '#111111', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: '#71717a', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  infoButton: { position: 'absolute', bottom: 35, right: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  caption: { position: 'absolute', bottom: 43, right: 64, maxWidth: '70%', backgroundColor: '#ffffff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  captionText: { color: '#71717a', fontSize: 11 },
});
