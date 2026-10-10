import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { ShipmentDetailsSheet } from "@/src/components/shipments/ShipmentDetails";
import { ShipmentSummarySheet } from '@/src/components/dashboard/ShipmentSummarySheet';
import { shipmentSummaryFilters, summaryShipments, type ShipmentSummaryFilter } from '@/src/components/dashboard/shipment-summary';
import { StopDetailsSheet } from '@/src/components/dashboard/StopDetailsSheet';
import { RunTimeline, type RunStop } from '@/src/components/dashboard/RunTimeline';
import { RunAdditionalCosts } from '@/src/components/dashboard/RunAdditionalCosts';
import { RunActions } from '@/src/components/runs/RunActions';
import { MessageSheet, type MessageSheetRef } from '@/component/ui/MessageSheet';
import { FinalDestinationSheet } from '@/src/components/dashboard/FinalDestinationSheet';
import { filterRunStops } from '@/src/components/dashboard/run-stop-filter';
import { ActionSheet, type ActionSheetRef } from '@/component/ui/ActionSheet';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useGuidance } from '@/src/navigation/GuidanceProvider';
import { PersistentBottomSheet } from '@/component/ui/PersistentBottomSheet';
import { ActiveRunDock } from '@/src/components/dashboard/ActiveRunDock';
import { NextDeliveryCard, nextDelivery } from '@/src/components/dashboard/NextDeliveryCard';
import { RunMap } from '@/src/components/dashboard/RunMap';
import { locationCoordinate } from '@/src/components/dashboard/run-map-data';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiRequestError, DeliveryOffer, DriverDashboard, driverApi, documentImportApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';
import { useRequiredDocuments } from '@/src/providers/required-documents-provider';

export default function HomeScreen() {
  const { run_id, navigation_shipment_id, navigation_request, navigation_owner } = useLocalSearchParams<{ run_id?: string; navigation_shipment_id?: string; navigation_request?: string; navigation_owner?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedStop, setSelectedStop] = useState<RunStop | null>(null);
  const messageSheet = useRef<MessageSheetRef>(null);
  const shipmentSheet = useRef<BottomSheetModal>(null);
  const [shipmentList, setShipmentList] = useState<{ key: string; filter: ShipmentSummaryFilter } | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<string | null>(null);
  const openShipment = (id: string) => setSelectedShipment(id);
  const runFilterSheet = useRef<ActionSheetRef>(null);
  const [choosingDestination, setChoosingDestination] = useState(false);
  const [runFilter, setRunFilter] = useState<'all' | 'shipments' | 'speeding'>('all');
  const openRunFilter = () => runFilterSheet.current?.present({
    title: 'Current run view',
    actions: [
      { id: 'all', label: 'All stops', selected: runFilter === 'all', onPress: () => setRunFilter('all') },
      { id: 'speeding', label: 'Speeding events', selected: runFilter === 'speeding', onPress: () => setRunFilter('speeding') },
      { id: 'shipments', label: 'Shipment deliveries', selected: runFilter === 'shipments', onPress: () => setRunFilter('shipments') },
    ],
  });
  const { session } = useAuth();
  const { updateCount } = useRequiredDocuments();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const surface = dark ? '#18181b' : '#ffffff';
  const warning = dark ? '#fde68a' : '#92400e';
  const accent = dark ? '#86efac' : '#15803d';
  const { height } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const [containerHeight, setContainerHeight] = useState(height - tabBarHeight);
  const sheetPosition = useSharedValue((height - tabBarHeight + insets.top) * 0.5);
  const [dashboard, setDashboard] = useState<DriverDashboard | null>(null);
  const shipmentListKey = JSON.stringify([session?.token, dashboard?.current_run?.run_id]);
  useEffect(() => { setShipmentList(null); }, [shipmentListKey]);
  const requiredNoteRunId = dashboard?.delivery_note_required_run_id;
  const mapTopInset = insets.top;
  const mapStyle = useAnimatedStyle(() => ({
    // Keep the half-height map behind an expanded sheet; grow it when the sheet collapses.
    height: Math.min(containerHeight, Math.max((containerHeight + mapTopInset) * 0.5 + 28, sheetPosition.value + 28)),
  }), [containerHeight, mapTopInset]);
  const ink = dark ? '#ffffff' : '#111111';
  const muted = dark ? '#a1a1aa' : '#71717a';
  const line = dark ? '#303036' : '#dedee1';
  const [offers, setOffers] = useState<DeliveryOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerBusy, setOfferBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>();
  const [starting, setStarting] = useState(false);
  const requestNumber = useRef(0);
  useEffect(() => { requestNumber.current++; setSelectedStop(null); setSelectedShipment(null); setDashboard(null); setOffers([]); setError(null); setLastUpdated(undefined); setRefreshing(false); }, [session?.token]);

  const load = useCallback(async (isCurrent: () => boolean = () => true, pullToRefresh = false) => {
    if (!session?.token) return;
    const version = ++requestNumber.current;
    setLoading(true);
    if (pullToRefresh) setRefreshing(true);
    try {
      const result = await driverApi.dashboard(session.token, run_id);
      if (!isCurrent() || version !== requestNumber.current) return;
      setDashboard(result);
      updateCount(result.documents.missing_required_count, result.documents.expired_count);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
      // Offers remain actionable when assigned by dispatch; this screen never changes availability.
      const activeOffers = await driverApi.listOffers(session.token);
      if (isCurrent() && version === requestNumber.current) setOffers(activeOffers);
    } catch (failure) {
      if (isCurrent() && version === requestNumber.current) setError((failure as ApiRequestError).message || 'Unable to refresh your deliveries.');
    } finally {
      if (isCurrent() && version === requestNumber.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [session, run_id, updateCount]);

  useFocusEffect(useCallback(() => {
    let current = true;
    void load(() => current);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load(() => current); });
    return () => { current = false; requestNumber.current++; setRefreshing(false); listener.remove(); };
  }, [load]));

  // Older servers already identify runs needing a note through the map notice.
  const canUploadRunNote = dashboard?.current_run?.has_delivery_note === false
    || (dashboard?.current_run?.has_delivery_note === undefined && !!requiredNoteRunId && requiredNoteRunId === dashboard?.current_run?.run_id);

  const shipments = useMemo(() => dashboard?.run_shipments ?? [], [dashboard?.run_shipments]);
  const next = nextDelivery(shipments);
  const guidance = useGuidance();
  const selectedNavigation = guidance.state.target?.owner === session?.token ? guidance.state.target : undefined;
  useEffect(() => { if (guidance.state.phase === 'idle' && guidance.state.error) Alert.alert('Navigation unavailable', guidance.state.error); }, [guidance.state.phase, guidance.state.error]);
  const navigationShipment = selectedNavigation && selectedNavigation.owner === session?.token && selectedNavigation.runId === dashboard?.current_run?.run_id
    && dashboard?.current_run?.status === 'in_progress' && !requiredNoteRunId
    ? shipments.find(s => s.shipment_id === selectedNavigation.shipmentId && !['delivered', 'failed', 'cancelled', 'returned'].includes(s.status)) : undefined;
  useEffect(() => { if (guidance.state.phase !== 'stopping' && guidance.state.target && dashboard && !navigationShipment) void guidance.exit(); }, [guidance, dashboard, navigationShipment]);
  const startNavigation = useCallback((shipmentId: string) => {
    if (!session || !dashboard) return;
    if (!guidance.available) { Alert.alert('Navigation unavailable', 'Turn-by-turn navigation requires the updated native app.'); return; }
    const shipment = shipments.find(s => s.shipment_id === shipmentId && !['delivered', 'failed', 'cancelled', 'returned'].includes(s.status));
    const destination = locationCoordinate(shipment?.dropoff_location);
    if (!shipment || !destination || dashboard.current_run?.status !== 'in_progress' || requiredNoteRunId) {
      Alert.alert('Navigation unavailable', 'Choose an eligible delivery on your active run and complete any required delivery-note upload.'); return;
    }
    void guidance.start({ owner: session.token, runId: dashboard.current_run.run_id, shipmentId,
      title: shipment.dropoff_location?.name || shipment.dropoff_location?.full_address || 'Delivery destination', ...destination });
  }, [guidance, shipments, dashboard, session, requiredNoteRunId]);
  const consumedNavigationRequest = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!navigation_request || !navigation_shipment_id || !session || !dashboard || consumedNavigationRequest.current === navigation_request) return;
    consumedNavigationRequest.current = navigation_request;
    router.setParams({ navigation_request: '', navigation_shipment_id: '', navigation_owner: '' });
    if (navigation_owner === session.user.user_id) startNavigation(navigation_shipment_id);
  }, [navigation_request, navigation_shipment_id, navigation_owner, session, dashboard, startNavigation, router]);
  const [nextCardHeight, setNextCardHeight] = useState(0);
  const [runDockHeight, setRunDockHeight] = useState(98);
  const showRunDock = !!session && dashboard?.current_run?.status === 'in_progress';
  const showNext = !navigationShipment && !requiredNoteRunId && dashboard?.current_run?.status === "in_progress" && !!next;
  const needsDestination = !!dashboard?.current_run && !dashboard.current_run.destination_location_id && !dashboard.trip_endpoints?.some(endpoint => endpoint.role === 'Planned end location');
  const showDestinationEntry = needsDestination && runFilter === 'all';
  const visibleStops = filterRunStops([...(dashboard?.recorded_stops ?? []), ...(dashboard?.planned_delivery_stops ?? [])], runFilter);
  const offer = offers[0];

  async function respondToOffer(accept: boolean) {
    if (!offer || !session) return;
    setOfferBusy(true);
    try {
      if (accept) {
        const result = await driverApi.acceptOffer(session.token, offer.offer_id);
        setOffers((items) => items.filter((item) => item.offer_id !== offer.offer_id));
        router.push(`/shipments/${result.shipment.shipment_id}`);
      } else {
        const result = await driverApi.declineOffer(session.token, offer.offer_id);
        setOffers((items) => [...(result.next_offer ? [result.next_offer] : []), ...items.filter((item) => item.offer_id !== offer.offer_id)]);
      }
    } catch (failure) {
      setError((failure as ApiRequestError).message || 'Unable to respond to the offer.');
    } finally { setOfferBusy(false); }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: surface }}>
      <View style={{ flex: 1, overflow: 'hidden' }} onLayout={event => setContainerHeight(event.nativeEvent.layout.height)}>
      <Animated.View style={mapStyle}>
        <RunMap runId={dashboard?.current_run?.run_id} token={session?.token} shipments={shipments} endpoints={dashboard?.trip_endpoints} topInset={mapTopInset + (showNext ? nextCardHeight : 0)} onOpenShipment={openShipment}
          navigationShipment={navigationShipment} onStopNavigation={() => void guidance.exit()} />
      {showNext && next && session && dashboard?.current_run && <NextDeliveryCard key={dashboard.current_run.run_id} shipment={next} runId={dashboard.current_run.run_id} token={session.token} topInset={mapTopInset} onHeightChange={setNextCardHeight} onOpenShipment={openShipment}
        onNavigate={startNavigation} />}
      {requiredNoteRunId ? <View pointerEvents="box-none" style={[styles.documentNoticeOverlay, { paddingTop: insets.top }]}>
          <Pressable style={[styles.documentNotice, { backgroundColor: surface }]} onPress={() => router.push({ pathname: '/shipments/load', params: { run_id: requiredNoteRunId } })} accessibilityRole="button" accessibilityLabel="Important: upload a delivery note" accessibilityHint="Opens delivery-note upload for this run">
            <Feather name="alert-triangle" size={24} color={dark ? '#fde68a' : '#92400e'} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: dark ? '#fde68a' : '#92400e' }}>Upload a delivery note</Text>
              <Text style={{ fontSize: 14, lineHeight: 21, color: dark ? '#fde68a' : '#92400e' }}>We’ve noticed you’re on the road and have no shipments attached to your run. Upload a delivery note now.</Text>
            </View>
            <Feather name="chevron-right" size={20} color={dark ? '#fde68a' : '#92400e'} />
          </Pressable>
      </View> : null}
      </Animated.View>
      <PersistentBottomSheet key={showRunDock ? `active:${dashboard?.current_run?.run_id}` : 'dashboard'}
        topInset={mapTopInset} containerHeight={containerHeight} animatedPosition={sheetPosition}
        initialSnapIndex={showRunDock ? 0 : 1} collapsedHeight={showRunDock ? runDockHeight + 28 : undefined}
        header={showRunDock && dashboard?.current_run ? (expand, isExpanded) => <ActiveRunDock key={dashboard.current_run?.run_id}
          startedAt={dashboard.current_run?.started_at} endpoints={dashboard.trip_endpoints}
          showInfo={!isExpanded} onShowTimeline={expand} actions={session && dashboard.current_run && <RunActions key={`${session.user.user_id}:${dashboard.current_run.run_id}`} token={session.token} ownerId={session.user.user_id} run={dashboard.current_run} canUploadDeliveryNote={canUploadRunNote} disabled={!!error || refreshing} onSaved={() => void load()} />} onHeightChange={setRunDockHeight} /> : undefined}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 24 }}
        refreshControl={<RefreshControl tintColor={accent} colors={[accent]} refreshing={refreshing} onRefresh={() => void load(undefined, true)} />}
        showsVerticalScrollIndicator={false}>


        {loading && !dashboard ? <View style={{ paddingVertical: 48, alignItems: 'center', gap: 16 }}><ActivityIndicator size="large" color="#15803d" /><Text style={{ color: ink }}>Checking your current run…</Text></View> : <>


        {error ? <Pressable accessibilityRole="button" accessibilityLabel="Retry loading dashboard" onPress={() => void load()} style={[styles.error, { backgroundColor: dark ? '#422006' : '#fffbeb' }]}><Text style={{ color: warning }}>{dashboard ? `Showing saved data${lastUpdated ? ` from ${lastUpdated}` : ''}. ` : ''}{error} Tap to retry.</Text></Pressable> : null}

        {loading && !dashboard ? <ActivityIndicator style={{ paddingVertical: 70 }} size="large" color="#15803d" /> : dashboard?.current_run ? (
          <View style={[styles.deliveryCard, { backgroundColor: dark ? '#18181b' : '#ffffff' }]}>
            {dashboard.current_run.status !== 'in_progress' && <Text style={[styles.runTitle, { color: ink }]}>Ready to start</Text>}
            {dashboard.current_run.end_request?.status === 'pending' && <View accessibilityRole="text" style={{ backgroundColor: '#dc2626', borderRadius: 28, padding: 16, marginTop: 8, marginBottom: 12, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Feather name="info" size={24} color="#ffffff" accessible={false} />
              <Text style={{ color: '#ffffff', fontSize: 16, lineHeight: 24, fontWeight: '600', flex: 1 }}>End run requested — awaiting dispatch approval</Text>
            </View>}
            {dashboard.current_run.end_request?.status === 'rejected' && <Text style={{ color: warning, marginTop: 8 }}>End run request rejected: {dashboard.current_run.end_request.review_reason}</Text>}
            <View style={styles.shipmentTotals}>
              {shipmentSummaryFilters.map(filter => {
                const count = summaryShipments(shipments, filter).length;
                return <Pressable key={filter} style={[styles.shipmentTotal, { backgroundColor: dark ? '#27272a' : '#f5f5f8' }]}
                  accessibilityRole="button" accessibilityLabel={`${count} ${filter.toLowerCase()}. Show shipments`}
                  onPress={() => setShipmentList({ key: shipmentListKey, filter })}>
                  <Text style={[styles.shipmentTotalNumber, { color: filter === 'Delivered' ? accent : ink }]}>{count}</Text>
                  <Text style={[styles.shipmentTotalLabel, { color: muted }]}>{filter}</Text>
                </Pressable>;
              })}
            </View>
            {shipments.length > 0 && shipments.every(s => s.status === 'delivered') && <Text style={{ color: accent, marginTop: 12 }}>Deliveries completed — awaiting dispatch closure.</Text>}
            {['draft', 'dispatched'].includes(dashboard.current_run.status) && <Pressable style={[styles.primary, { marginTop: 16 }]} disabled={starting} onPress={async () => {
              if (!session || !dashboard.current_run) return;
              setStarting(true); try { await documentImportApi.startRun(session.token, dashboard.current_run.run_id); await load(); } catch (e) { setError((e as Error).message); } finally { setStarting(false); }
            }} accessibilityRole="button"><Text style={styles.primaryText}>{starting ? 'Starting…' : 'Start run'}</Text></Pressable>}
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: muted, flexShrink: 1 }}>{visibleStops.length + (showDestinationEntry ? 1 : 0)} {runFilter === 'speeding' ? (visibleStops.length === 1 ? 'speeding event' : 'speeding events') : (visibleStops.length + (showDestinationEntry ? 1 : 0) === 1 ? 'timeline entry' : 'timeline entries')}{runFilter === 'shipments' ? ' for deliveries' : ''}</Text>
              <Pressable onPress={openRunFilter} accessibilityRole="button" accessibilityLabel={`Current run view: ${runFilter === 'all' ? 'All stops' : runFilter === 'speeding' ? 'Speeding events' : 'Shipment deliveries'}`}
                style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: muted }}>{runFilter === 'all' ? 'Filter timeline' : runFilter === 'speeding' ? 'Speeding events' : 'Shipment deliveries'}</Text>
              </Pressable>
              </View>
              {visibleStops.length ? <RunTimeline stops={visibleStops} ink={ink} muted={muted} line={line} hasTrailingEntry={showDestinationEntry}
                onOpenShipment={openShipment}
                onOpenStop={setSelectedStop} /> : runFilter === 'speeding' ? <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32, marginBottom: 16, gap: 12 }}>
                  <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: dark ? '#163829' : '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="activity" size={26} color={dark ? '#86efac' : '#15803d'} />
                  </View>
                  <View style={{ gap: 6, maxWidth: 300 }}>
                    <Text style={{ color: ink, fontSize: 17, lineHeight: 24, fontWeight: '600', textAlign: 'center' }}>No speeding events</Text>
                    <Text style={{ color: muted, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>No speeding events have been recorded for this run.</Text>
                  </View>
                </View> : <Text style={{ fontSize: 13, color: muted, marginBottom: 16 }}>{runFilter === 'shipments' ? 'No visited or planned delivery stops for this run yet.' : 'No stops recorded or planned for this run yet.'}</Text>}
              {showDestinationEntry && <View style={styles.timelineRow}>
                <View style={styles.timelineRail}><View style={[styles.timelineMarker, { backgroundColor: '#71717a' }]}><Feather name="flag" size={14} color="#fff" /></View></View>
                <View style={[styles.timelineContent, { paddingBottom: 20, gap: 10 }]}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>Planned final destination</Text>
                  <Text style={{ color: muted }}>No final destination chosen for this run.</Text>
                  <Pressable accessibilityRole="button" onPress={() => setChoosingDestination(true)} style={styles.primary}><Text style={styles.primaryText}>Choose final destination</Text></Pressable>
                </View>
              </View>}
              <RunAdditionalCosts costs={dashboard.additional_costs} ink={ink} muted={muted} line={line} />
            </View>
          </View>
        ) : null}

        {dashboard && !dashboard.current_run ? <View style={{ paddingTop: 24, paddingBottom: 16, gap: 12 }}>
          <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>YOUR DAY</Text>
          <Text style={[styles.runTitle, { color: ink }]}>No current run</Text>
          <Text style={{ color: muted }}>Upload a delivery note to prepare your next run.</Text>
          <Pressable style={[styles.primary, { marginTop: 4 }]} onPress={() => router.push('/shipments/load')} accessibilityRole="button">
            <Text style={styles.primaryText}>Upload delivery note</Text>
          </Pressable>
        </View> : null}
        {offer ? <View style={[styles.offer, { borderColor: line }]}>
          <Text style={[styles.name, { color: ink }]}>New delivery offer</Text>
          <Text style={{ color: muted, marginTop: 8 }}>{offer.shipment?.merchant_order_ref || 'Delivery from dispatch'}</Text>
          <Text style={{ color: muted, marginTop: 8 }}>Pickup: {offer.shipment?.pickup_location?.full_address || 'Address not provided'}</Text>
          <Text style={{ color: muted, marginTop: 4 }}>Drop-off: {offer.shipment?.dropoff_location?.full_address || 'Address not provided'}</Text>
          <View style={{ flexDirection: 'row', gap: 20, marginTop: 18 }}>
            <Pressable disabled={offerBusy} onPress={() => void respondToOffer(false)} style={{ padding: 12 }} accessibilityRole="button"><Text style={{ color: muted }}>Decline</Text></Pressable>
            <Pressable disabled={offerBusy} onPress={() => void respondToOffer(true)} style={[styles.primary, { flex: 1 }]} accessibilityRole="button"><Text style={styles.primaryText}>{offerBusy ? 'Please wait…' : 'Accept offer'}</Text></Pressable>
          </View>
        </View> : null}
        </>}
      </ScrollView>
      </PersistentBottomSheet>
      </View>
      <MessageSheet ref={messageSheet} />
      {shipmentList?.key === shipmentListKey && session && dashboard?.current_run && <ShipmentSummarySheet
        key={`${shipmentListKey}:${shipmentList.filter}`} shipments={shipments} filter={shipmentList.filter}
        onDismiss={() => setShipmentList(null)} onOpenShipment={openShipment} />}
      {selectedShipment && session && <ShipmentDetailsSheet
        key={`${session.token}:${selectedShipment}`}
        modalRef={shipmentSheet} shipmentId={selectedShipment} onNavigate={startNavigation} autoPresent
        onDismiss={() => { setSelectedShipment(null); void load(); }}
      />}
      <StopDetailsSheet shipments={shipments} endpoints={dashboard?.trip_endpoints} stop={selectedStop} onDismiss={() => setSelectedStop(null)}
        onOpenShipment={openShipment} />
      <ActionSheet ref={runFilterSheet} />
      {choosingDestination && session && dashboard?.current_run && <FinalDestinationSheet key={`${session.user.user_id}:${dashboard.current_run.run_id}`} token={session.token} runId={dashboard.current_run.run_id} onDismiss={() => setChoosingDestination(false)} onSaved={() => void load()} />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  documentNoticeOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingBottom: 28 },
  documentNotice: { width: '100%', maxWidth: 420, flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 18, borderRadius: 18, backgroundColor: '#ffffff', shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 8 },
  name: { fontSize: 17, fontWeight: '700' },
  date: { fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', textAlign: 'center', marginBottom: 14 },
  deliveryCard: { borderRadius: 16 },
  shipmentTotals: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 8 },
  shipmentTotal: { flex: 1, minWidth: 0, gap: 4, padding: 12, borderRadius: 12 },
  shipmentTotalNumber: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  shipmentTotalLabel: { fontSize: 12, lineHeight: 18 },
  runTitle: { fontSize: 23, lineHeight: 31, fontWeight: '700', letterSpacing: -0.4 },
  runSummary: { fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 20 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineRail: { width: 24, alignItems: 'center' },
  timelineMarker: { width: 24, minHeight: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  markerText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  timelineConnector: { width: 2, flex: 1 },
  timelineContent: { flex: 1, gap: 8 },
  timelineShipmentLink: { minHeight: 36, paddingVertical: 8, paddingLeft: 8, justifyContent: 'center', position: 'relative' },
  // Content starts 36pt from the row edge; the 2pt rail is centred at 12pt.
  // A rounded bottom-left corner turns the branch from the rail toward its link.
  timelineShipmentBranch: { position: 'absolute', left: -25, top: 4, width: 25, height: 15, borderLeftWidth: 2, borderBottomWidth: 2, borderBottomLeftRadius: 14 },
  shipmentMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  shipmentReference: { fontSize: 10, fontWeight: '600', flexShrink: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  shipmentTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  shipmentRoute: { fontSize: 13, lineHeight: 19 },
  shipmentActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  openShipment: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  primary: { minHeight: 50, borderRadius: 10, backgroundColor: '#15803d', flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  primaryText: { color: '#ffffff', fontSize: 17, fontWeight: '600' },
  error: { backgroundColor: '#fef3c7', padding: 14, borderRadius: 10, marginBottom: 16 },
  offer: { marginTop: 14, paddingTop: 20, borderTopWidth: 1 },
});
