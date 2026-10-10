import { useIsFocused } from 'expo-router/react-navigation';
import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Callout, Marker, Polyline } from 'react-native-maps';
import { ActionSheet, type ActionSheetRef } from '@/component/ui/ActionSheet';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Text } from '@/component/ui/Text';
import { driverApi, type RunPosition, type RunDirections, type DriverShipment } from '@/src/lib/api';
import { useRecordedRunTrack } from './useRecordedRunTrack';
import { NativeMap } from './NativeMap';
import { truckPositionDescription } from './truck-position-label';
import { currentNavigationLocation } from './navigation-location';
import { groupRunMapStops, locationCoordinate, runMapStops } from './run-map-data';

// Temporarily hide mode selection; keep Recorded available for re-enabling later.
const SHOW_MAP_MODE_SWITCH = false;

export type RunMapProps = {
  shipments: DriverShipment[];
  endpoints?: { role: string; name: string; latitude: number | null; longitude: number | null; address?: string }[];
  runId?: string;
  token?: string;
  topInset: number;
  onOpenShipment: (id: string) => void;
  navigationShipment?: DriverShipment;
  onStopNavigation?: () => void;
};

/** Road geometry is fetched separately so routing never blocks the dashboard. */
export function RunMap({ shipments, endpoints, runId, token, topInset, onOpenShipment, navigationShipment, onStopNavigation }: RunMapProps) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const surface = dark ? '#18181b' : '#ffffff';
  const ink = dark ? '#fafafa' : '#111111';
  const muted = dark ? '#a1a1aa' : '#71717a';
  const accent = dark ? '#86efac' : '#15803d';
  const navigationId = navigationShipment?.shipment_id;
  const [navigationPanelHeight, setNavigationPanelHeight] = useState(160);
  const endpointPins = useMemo(() => (navigationId ? [] : endpoints || []).filter(p => p.latitude != null && p.longitude != null).map(p => ({ ...p, coordinate: { latitude: p.latitude!, longitude: p.longitude! } })), [endpoints, navigationId]);
  const ref = useRef<MapView>(null);
  const actions = useRef<ActionSheetRef>(null);
  const [routeRetry, setRouteRetry] = useState(0);
  const [showRouteInfo, setShowRouteInfo] = useState(false);
  const [ready, setReady] = useState(false);
  const focused = useIsFocused();
  const mapLifecycle = useRef({ ready: false, loaded: false, width: 0, height: 0 });
  const [selectedMode, setMode] = useState<'planned' | 'recorded'>('planned');
  const mode = runId && SHOW_MAP_MODE_SWITCH ? selectedMode : 'planned';
  const recorded = useRecordedRunTrack(runId, token, focused && mode === 'recorded');
  const recordedPoints = useMemo(() => recorded.track?.segments.flat() ?? [], [recorded.track]);
  const positionKey = JSON.stringify([token, runId ?? null]);
  const [positionResult, setPositionResult] = useState<{ key: string; value: RunPosition } | null>(null);
  const [positionFailed, setPositionFailed] = useState(false);
  const position = positionResult?.key === positionKey ? positionResult.value : null;
  const truckLatitude = position?.coordinate?.latitude;
  const truckLongitude = position?.coordinate?.longitude;
  const truck = useMemo(() => truckLatitude != null && truckLongitude != null ? { latitude: truckLatitude, longitude: truckLongitude } : null, [truckLatitude, truckLongitude]);
  useEffect(() => {
    if (!focused || !token) return;
    let cancelled = false;
    let pending = false;
    let failureReported = false;
    const refresh = async () => {
      if (pending || AppState.currentState !== 'active') return;
      pending = true;
      try {
        const value = await (runId ? driverApi.runPosition(token, runId) : driverApi.truckPosition(token));
        if (!cancelled) {
          setPositionResult({ key: positionKey, value }); setPositionFailed(false);
          failureReported = false;
          if (__DEV__) console.info('[RunMap] truck-position response', { hasVehicle: !!value.vehicle_id, hasCoordinate: !!value.coordinate });
        }
      } catch (error) {
        if (!cancelled) {
          setPositionFailed(true);
          // Polling failures are recoverable; console.error opens Expo's red
          // error overlay even though we already handle the unavailable state.
          if (__DEV__ && !failureReported) console.info('[RunMap] truck-position temporarily unavailable; retrying automatically', { message: error instanceof Error ? error.message : 'Unknown error' });
          failureReported = true;
        }
      }
      finally { pending = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { cancelled = true; clearInterval(timer); subscription.remove(); };
  }, [focused, runId, token, positionKey]);
  const stops = useMemo(() => runMapStops(shipments).filter(stop => !navigationId || stop.shipment.shipment_id === navigationId), [shipments, navigationId]);
  const groups = useMemo(() => groupRunMapStops(stops), [stops]);
  const popupKey = JSON.stringify([positionKey, navigationId, mode]);
  const [popup, setPopup] = useState<{ key: string; ids: string; point: { x: number; y: number } } | null>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [popupHeight, setPopupHeight] = useState(120);
  const popupRevision = useRef(0);
  const groupIds = (group: typeof groups[number]) => group.stops.map(stop => `${stop.shipment.shipment_id}-${stop.shipment.status}`).join(',');
  const popupGroup = focused && popup?.key === popupKey ? groups.find(group => groupIds(group) === popup.ids) : undefined;
  const dismissPopup = () => { popupRevision.current++; setPopup(null); };
  const showPopup = async (group: typeof groups[number]) => {
    const version = ++popupRevision.current;
    setPopup(null);
    try {
      const point = await ref.current?.pointForCoordinate(group.coordinate);
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y) && version === popupRevision.current) {
        setPopup({ key: popupKey, ids: groupIds(group), point });
      }
    } catch { /* A provider remount or a map that is not ready cannot anchor a popup. */ }
  };
  useEffect(() => {
    const counter = popupRevision;
    setPopup(null);
    return () => { counter.current++; };
  }, [popupKey, focused]);
  useEffect(() => {
    const counter = popupRevision;
    return () => { counter.current++; };
  }, [groups]);
  const popupClearance = topInset + (navigationId ? navigationPanelHeight + 24 : 0) + 12;
  const popupTop = popup ? (popup.point.y - popupHeight - 40 >= popupClearance
    ? popup.point.y - popupHeight - 40 : popup.point.y + 20) : 0;
  const popupWidth = Math.min(260, mapSize.width - 24);
  const popupLeft = popup ? Math.max(12, Math.min(popup.point.x - popupWidth / 2, mapSize.width - popupWidth - 12)) : 0;
  const popupY = Math.max(popupClearance, Math.min(popupTop, mapSize.height - popupHeight - 12));
  const popupAbove = !!popup && popupY + popupHeight <= popup.point.y;
  const pointerEdge = popupAbove ? popupY + popupHeight : popupY;
  const pointerHeight = popup ? Math.abs(popup.point.y - (popupAbove ? 30 : 0) - pointerEdge) : 0;
  const pointerBase = popup ? Math.max(24, Math.min(popup.point.x - popupLeft, popupWidth - 24)) : 0;
  const pointerShift = popup ? popup.point.x - popupLeft - pointerBase : 0;
  const openPopupShipment = () => {
    if (!popupGroup) return;
    dismissPopup();
    if (popupGroup.stops.length === 1) return onOpenShipment(popupGroup.stops[0].shipment.shipment_id);
    actions.current?.present({ title: 'Shipments at this stop', actions: popupGroup.stops.map(stop => ({
      id: stop.shipment.shipment_id, label: `${stop.number}. ${stop.shipment.merchant_order_ref || 'Shipment'}`,
      onPress: () => onOpenShipment(stop.shipment.shipment_id),
    })) });
  };
  const routeKey = JSON.stringify([token, runId, navigationId, endpointPins, stops.map(stop => [stop.shipment.shipment_id, stop.coordinate])]);
  const [result, setResult] = useState<{ key: string; route: RunDirections } | null>(null);
  const route = result?.key === routeKey ? result.route : null;
  const [navigationError, setNavigationError] = useState<{ key: string; message: string } | null>(null);
  const phone = navigationId ? route?.origin_coordinate : undefined;
  const mapOrigin = navigationId ? phone : truck;
  useEffect(() => {
    let cancelled = false, pending = false, requestPermission = true;
    if (!focused || mode !== 'planned' || !runId || !token || (!stops.length && !endpointPins.length && !navigationId)) return;
    const refresh = async () => {
      if (pending || cancelled || AppState.currentState !== 'active') return;
      pending = true;
      try {
        if (navigationId) setNavigationError(null);
        const mayRequestPermission = requestPermission;
        requestPermission = false;
        const origin = navigationId ? await currentNavigationLocation(() => !cancelled && AppState.currentState === 'active', mayRequestPermission) : undefined;
        if (cancelled || AppState.currentState !== 'active') return;
        const value = navigationId && origin ? await driverApi.runNavigation(token, runId, navigationId, origin) : await driverApi.runDirections(token, runId);
        if (!cancelled) setResult({ key: routeKey, route: navigationId && (value.shipment_id !== navigationId || value.origin_source !== 'phone'
          || value.origin_coordinate?.latitude !== origin?.latitude || value.origin_coordinate?.longitude !== origin?.longitude) ? { status: 'unavailable' } : value });
      } catch (error) {
        if (!cancelled) {
          setResult({ key: routeKey, route: { status: 'unavailable' } });
          if (navigationId) setNavigationError({ key: routeKey, message: error instanceof Error ? error.message : 'Phone location or routing is unavailable. Try again.' });
        }
      } finally { pending = false; }
    };
    void refresh();
    const timer = navigationId ? setInterval(() => void refresh(), 60_000) : undefined;
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { cancelled = true; if (timer) clearInterval(timer); listener.remove(); };
  }, [runId, token, routeKey, stops.length, endpointPins.length, routeRetry, mode, navigationId, focused]);
  const road = route?.status === 'ready' ? route.coordinates : undefined;
  const fit = useCallback(() => {
    const coordinates = mode === 'recorded' ? [...recordedPoints, ...(mapOrigin ? [mapOrigin] : [])] : [...(road ?? []), ...stops.map(stop => stop.coordinate), ...endpointPins.map(p => p.coordinate), ...(mapOrigin ? [mapOrigin] : [])];
    if (!ready || !coordinates.length) return;
    if (coordinates.length === 1) {
      ref.current?.animateToRegion({ ...coordinates[0], latitudeDelta: 0.025, longitudeDelta: 0.025 }, 250);
    } else {
      ref.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: topInset + (navigationId ? navigationPanelHeight + 24 : mode === 'recorded' ? 180 : 65), right: 40, bottom: 105, left: 40 }, animated: false,
      });
    }
  }, [ready, stops, topInset, road, mapOrigin, endpointPins, mode, recordedPoints, navigationId, navigationPanelHeight]);
  useEffect(fit, [fit]);
  const missing = navigationId ? (locationCoordinate(navigationShipment?.dropoff_location) ? 0 : 1) : shipments.length - stops.length;
  return <View style={[styles.container, { backgroundColor: dark ? '#18181b' : '#eeeee8' }]}>
    <NativeMap dark={dark} mapPadding={{ top: 0, right: 0, bottom: 45, left: 0 }} ref={ref} style={StyleSheet.absoluteFill} onMapReady={() => {
      mapLifecycle.current.ready = true;
      setReady(true);
      fit();
      if (__DEV__) console.info('[RunMap] native map ready');
    }} onMapLoaded={() => {
      mapLifecycle.current.loaded = true;
      if (__DEV__) console.info('[RunMap] map tiles loaded');
    }} onLayout={event => {
      const { width, height } = event.nativeEvent.layout;
      mapLifecycle.current.width = width; mapLifecycle.current.height = height;
      setMapSize({ width, height });
      if (__DEV__) console.info('[RunMap] layout', { width, height });
      fit();
    }}
      onPress={event => { if (event.nativeEvent.action !== 'marker-press') dismissPopup(); }}
      onPanDrag={dismissPopup}
      onRegionChangeComplete={() => { if (popupGroup) void showPopup(popupGroup); }}
      initialRegion={{ latitude: 0, longitude: 0, latitudeDelta: 100, longitudeDelta: 100 }}
      showsPointsOfInterests={false} showsCompass={false} rotateEnabled={false} pitchEnabled={false}
      accessibilityLabel={navigationId ? 'Route to selected delivery' : runId ? 'Current run shipment locations' : 'Current truck location'}>
      {mode === 'planned' && road && missing === 0 ? <Polyline coordinates={road} strokeColor={accent} strokeWidth={4} /> : null}
      {mode === 'planned' && endpointPins.map(p => <Marker key={p.role} coordinate={p.coordinate} onPress={dismissPopup} title={`${p.role} · ${p.name}`} description={p.address} pinColor={p.role === 'Run starting point' ? '#2563eb' : '#71717a'} />)}
      {phone && <Marker coordinate={phone} onPress={dismissPopup} title="Your phone location" pinColor="#2563eb" />}
      {!navigationId && truck ? <Marker coordinate={truck} onPress={dismissPopup} zIndex={100} title={position?.plate_number ? `Truck · ${position.plate_number}` : 'Your truck'}
        description={truckPositionDescription(position)}>
        <View style={styles.truckMarker}><Feather name="truck" size={21} color="#ffffff" /></View>
        <Callout tooltip><View style={[styles.truckCallout, { backgroundColor: surface }]}>
          <Text style={[styles.truckCalloutTitle, { color: ink }]}>{position?.plate_number ? `Truck · ${position.plate_number}` : 'Your truck'}</Text>
          {truckPositionDescription(position).split('\n').map((line, index, lines) => <Text key={index} style={[index === lines.length - 1 ? styles.truckCalloutTime : styles.truckCalloutLocation, { color: index === lines.length - 1 ? muted : ink }]}>{line}</Text>)}
        </View></Callout>
      </Marker> : null}
      {mode === 'planned' && groups.map(group => {
        const numbers = group.stops.map(stop => stop.number).join(' · ');
        const allDelivered = group.stops.every(stop => stop.shipment.status === 'delivered');
        return <Marker key={groupIds(group)} coordinate={group.coordinate}
          identifier={`stop-${numbers}`} accessibilityLabel={`Stop ${numbers}. Show shipment location`}
          onPress={event => { event.stopPropagation?.(); void showPopup(group); }}>
          <View style={[styles.marker, { backgroundColor: allDelivered ? '#24753a' : '#15803d' }]}>
            <Text style={styles.number}>{numbers}</Text>
          </View>
        </Marker>;
      })}
      {mode === 'recorded' && recorded.track?.segments.map((segment, index) => segment.length > 1
        ? <Polyline key={index} coordinates={segment} strokeColor="#2563eb" strokeWidth={4} />
        : segment[0] ? <Marker key={index} coordinate={segment[0]} title="Recorded position" /> : null)}
      {mode === 'recorded' && recorded.track?.stops.map((stop, index) => <Marker key={index} coordinate={stop} title="Stationary"
        description={`${new Date(stop.first_seen_at).toLocaleString()} – ${new Date(stop.last_seen_at).toLocaleString()}`} pinColor="#71717a" />)}
    </NativeMap>
    {popupGroup && popup && mapSize.width > 0 && <View
      onLayout={event => setPopupHeight(event.nativeEvent.layout.height)}
      style={[styles.shipmentPopup, { backgroundColor: surface, width: popupWidth, left: popupLeft, top: popupY }]}>
      {pointerHeight > 0 && <View testID="shipment-popup-pointer" pointerEvents="none" style={[styles.popupPointer, {
        left: pointerBase - 10 + pointerShift / 2,
        top: popupAbove ? popupHeight : -pointerHeight,
        borderTopWidth: popupAbove ? pointerHeight : 0,
        borderBottomWidth: popupAbove ? 0 : pointerHeight,
        borderTopColor: surface, borderBottomColor: surface,
        transform: [{ skewX: `${Math.atan((popupAbove ? pointerShift : -pointerShift) / pointerHeight) * 180 / Math.PI}deg` }],
      }]} />}
      <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>{`${popupGroup.stops.length === 1 ? 'Stop' : 'Stops'} ${popupGroup.stops.map(stop => stop.number).join(' · ')}`}</Text>
      <Text style={[styles.truckCalloutTitle, { color: ink }]}>{[...new Set(popupGroup.stops.map(stop => stop.shipment.dropoff_location?.name?.trim() || 'Delivery location'))].join(' · ')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Shipment info" onPress={openPopupShipment} style={styles.shipmentInfoButton}>
        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>Shipment info</Text>
      </Pressable>
    </View>}
    {runId && SHOW_MAP_MODE_SWITCH ? <View style={[styles.modeToggle, { top: topInset + 12, backgroundColor: surface }]}>
      {(['planned', 'recorded'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: mode === value }}
        onPress={() => setMode(value)} style={[styles.modeButton, mode === value && { backgroundColor: '#15803d' }]}>
        <Text style={{ color: mode === value ? '#ffffff' : ink, fontSize: 13, fontWeight: '600' }}>{value === 'planned' ? 'Planned' : 'Recorded'}</Text>
      </Pressable>)}
    </View> : null}
    {mode === 'recorded' && runId ? <View style={[styles.recordedStatus, { top: topInset + 60, backgroundColor: surface }]}>
      <Text style={[styles.captionText, { color: muted }]}>{recorded.error ? (recorded.track ? 'Showing previous data. ' : '') + recorded.error
        : !recorded.track ? 'Loading recorded GPS…'
        : recorded.track.status === 'disabled' ? 'Recorded route display is not enabled.'
        : recorded.track.status === 'empty' ? 'No GPS history recorded yet.'
        : recorded.track.source === 'limited_history' ? 'Limited historical data · activity events only'
        : recorded.track.active && recorded.track.latest_observed_at && Date.now() - Date.parse(recorded.track.latest_observed_at) > 300000 ? 'Recorded GPS · tracking is stale'
        : recorded.track.coverage.partial ? 'Recorded GPS · partial route coverage' : 'Recorded GPS · gaps indicate missing tracking'}</Text>
      {recorded.track?.coverage.from && <Text style={[styles.captionText, { color: muted }]}>{new Date(recorded.track.coverage.from).toLocaleString()} – {new Date(recorded.track.coverage.to!).toLocaleString()}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Pressable accessibilityRole="button" onPress={recorded.retry} style={{ padding: 8 }}><Text style={[styles.captionText, { color: muted }]}>Refresh</Text></Pressable>
        {recorded.track?.coverage.next_before && <Pressable accessibilityRole="button" onPress={() => recorded.setBefore(recorded.track!.coverage.next_before!)} style={{ padding: 8 }}><Text style={[styles.captionText, { color: muted }]}>Earlier route</Text></Pressable>}
        {recorded.before && <Pressable accessibilityRole="button" onPress={() => recorded.setBefore(undefined)} style={{ padding: 8 }}><Text style={[styles.captionText, { color: muted }]}>Latest route</Text></Pressable>}
      </View>
    </View> : null}
    {mode === 'planned' && !truck && !navigationId ? <View pointerEvents="none" style={[styles.truckStatus, { top: topInset + (runId && SHOW_MAP_MODE_SWITCH ? 60 : 12), backgroundColor: surface }]}>
      <Feather name="truck" size={18} color="#2563eb" />
      <Text style={[styles.truckStatusText, { color: muted }]}>{positionFailed ? 'Truck location unavailable' : position ? (position.vehicle_id ? 'Truck location not reported yet' : 'No truck assigned') : 'Locating truck…'}</Text>
    </View> : null}
    <ActionSheet ref={actions} />
    {navigationShipment && <View style={[styles.navigationPanel, { top: topInset + 12, backgroundColor: surface }]}
      onLayout={event => setNavigationPanelHeight(event.nativeEvent.layout.height)}>
      <Text style={{ color: accent, fontSize: 11, fontWeight: '600' }}>ROUTE TO DELIVERY</Text>
      <Text style={{ color: ink, fontSize: 18, fontWeight: '600' }}>{navigationShipment.dropoff_location?.name || navigationShipment.dropoff_location?.full_address || 'Delivery destination'}</Text>
      <Text accessibilityLiveRegion="polite" style={{ color: muted, fontSize: 13 }}>{!route ? 'Finding your phone location and route…' : road
        ? `${(route.distance_meters! / 1000).toFixed(1)} km · ~${Math.ceil(route.duration_seconds! / 60)} min`
        : route.status === 'not_needed' ? 'Phone and destination share the same position.'
        : route.status === 'missing_locations' ? 'Phone or destination coordinates are unavailable.' : navigationError?.key === routeKey ? navigationError.message : 'Road directions unavailable.'}</Text>
      <Text style={{ color: muted, fontSize: 11 }}>From your phone location{route?.origin_reported_at ? ` · ${new Date(route.origin_reported_at).toLocaleString()}` : ''}</Text>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {route && route.status !== 'ready' && route.status !== 'not_needed' && <Pressable accessibilityRole="button" onPress={() => { setResult(null); setRouteRetry(v => v + 1); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: accent }}>Retry route</Text></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel="Stop navigation" onPress={onStopNavigation} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: ink }}>Stop navigation</Text></Pressable>
      </View>
    </View>}

    {mode === 'planned' && !navigationId && runId && !stops.length && !truck && !endpointPins.length ? <View pointerEvents="none" style={[styles.empty, { backgroundColor: surface }]}>
      <Text style={[styles.emptyTitle, { color: ink }]}>{shipments.length ? 'Run locations not mapped yet' : 'Your run map'}</Text>
      <Text style={[styles.emptyText, { color: muted }]}>{shipments.length ? 'Shipment locations will appear when their map coordinates are available.' : 'Assigned shipment locations will appear here.'}</Text>
    </View> : mode === 'planned' && !navigationId && runId && showRouteInfo ? <View style={[styles.caption, { backgroundColor: surface }]}>
      <Text style={[styles.captionText, { color: muted }]}>{!stops.length && truck ? 'Last reported truck position' : missing ? `${stops.length} of ${shipments.length} shipment locations mapped` : road ? `Google route · ${(route!.distance_meters! / 1000).toFixed(1)} km · ~${Math.ceil(route!.duration_seconds! / 60)} min` : groups.length === 1 ? 'Shipment stop' : !route ? 'Finding road directions…' : 'Road directions unavailable'}</Text>
      {route?.status === 'unavailable' && <Pressable accessibilityRole="button" onPress={() => { setResult(null); setRouteRetry(v => v + 1); }} style={{ padding: 8 }}><Text style={[styles.captionText, { color: muted }]}>Retry directions</Text></Pressable>}
    </View> : null}
    {mode === 'planned' && !navigationId && runId && (stops.length || truck || endpointPins.length) ? <Pressable style={[styles.infoButton, { backgroundColor: surface }]} onPress={() => setShowRouteInfo(value => !value)}
      accessibilityRole="button" accessibilityLabel={showRouteInfo ? 'Hide route information' : 'Show route information'}
      accessibilityState={{ expanded: showRouteInfo }}>
      <Feather name="info" size={20} color={showRouteInfo ? accent : muted} />
    </Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  navigationPanel: { position: 'absolute', left: 20, right: 20, borderRadius: 16, padding: 16, gap: 8 },
  modeToggle: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', padding: 4, borderRadius: 24, backgroundColor: '#ffffff' },
  modeButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  recordedStatus: { position: 'absolute', alignSelf: 'center', maxWidth: '90%', backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  container: { flex: 1, backgroundColor: '#eeeee8' },
  truckMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb', borderWidth: 3, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  truckCallout: { width: 260, padding: 12, gap: 4, borderRadius: 12 },
  truckCalloutTitle: { color: '#111111', fontSize: 14, fontWeight: '600' },
  truckCalloutLocation: { color: '#111111', fontSize: 13, lineHeight: 18 },
  truckCalloutTime: { color: '#52525b', fontSize: 11, lineHeight: 16 },
  truckStatus: { position: 'absolute', alignSelf: 'center', maxWidth: '92%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffffff' },
  truckStatusText: { fontSize: 11, color: '#374151', flexShrink: 1 },
  popupPointer: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  shipmentPopup: { position: 'absolute', padding: 12, gap: 12, borderRadius: 12, shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  shipmentInfoButton: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#15803d', alignItems: 'center', justifyContent: 'center' },
  marker: { minWidth: 30, paddingHorizontal: 6, height: 30, borderRadius: 15, borderWidth: 3, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  number: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  empty: { position: 'absolute', top: '42%', alignSelf: 'center', width: '82%', padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  emptyTitle: { color: '#111111', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: '#71717a', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  infoButton: { position: 'absolute', bottom: 35, right: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  caption: { position: 'absolute', bottom: 43, right: 64, maxWidth: '70%', backgroundColor: '#ffffff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  captionText: { color: '#71717a', fontSize: 11 },
});
