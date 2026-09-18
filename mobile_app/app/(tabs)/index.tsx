import { MessageSheet, type MessageSheetRef } from '@/component/ui/MessageSheet';
import { FinalDestinationSheet } from '@/src/components/dashboard/FinalDestinationSheet';
import { filterRunStops } from '@/src/components/dashboard/run-stop-filter';
import { ActionSheet, type ActionSheetRef } from '@/component/ui/ActionSheet';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { PersistentBottomSheet } from '@/component/ui/PersistentBottomSheet';
import { RunMap } from '@/src/components/dashboard/RunMap';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { type EffectCallback, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/component/ui/Text';
import { ApiRequestError, DeliveryOffer, DriverDashboard, driverApi, documentImportApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

function useDashboardFocus(effect: EffectCallback) {
  useFocusEffect(effect);
}

export default function HomeScreen() {
  const { run_id } = useLocalSearchParams<{ run_id?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const messageSheet = useRef<MessageSheetRef>(null);
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
  const dark = false; // This dashboard sheet stays white, matching the selected design.
  const { height } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const [containerHeight, setContainerHeight] = useState(height - tabBarHeight);
  const sheetPosition = useSharedValue((height - tabBarHeight + insets.top) * 0.5);
  const mapStyle = useAnimatedStyle(() => ({
    // Keep the half-height map behind an expanded sheet; grow it when the sheet collapses.
    height: Math.min(containerHeight, Math.max((containerHeight + insets.top) * 0.5 + 28, sheetPosition.value + 28)),
  }), [containerHeight, insets.top]);
  const ink = dark ? '#ffffff' : '#111111';
  const muted = dark ? '#a1a1aa' : '#71717a';
  const line = dark ? '#303036' : '#dedee1';
  const [dashboard, setDashboard] = useState<DriverDashboard | null>(null);
  const [offers, setOffers] = useState<DeliveryOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offerBusy, setOfferBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>();
  const [starting, setStarting] = useState(false);
  const requestNumber = useRef(0);
  useEffect(() => { requestNumber.current++; setDashboard(null); setOffers([]); setError(null); setLastUpdated(undefined); }, [session?.token]);

  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    if (!session?.token) return;
    const version = ++requestNumber.current;
    setLoading(true);
    try {
      const result = await driverApi.dashboard(session.token, run_id);
      if (!isCurrent() || version !== requestNumber.current) return;
      setDashboard(result);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
      // Offers remain actionable when assigned by dispatch; this screen never changes availability.
      const activeOffers = await driverApi.listOffers(session.token);
      if (isCurrent() && version === requestNumber.current) setOffers(activeOffers);
    } catch (failure) {
      if (isCurrent() && version === requestNumber.current) setError((failure as ApiRequestError).message || 'Unable to refresh your deliveries.');
    } finally {
      if (isCurrent() && version === requestNumber.current) setLoading(false);
    }
  }, [session?.token, run_id]);

  useFocusEffect(useCallback(() => {
    let current = true;
    void load(() => current);
    return () => { current = false; };
  }, [load]));

  const shipments = dashboard?.run_shipments ?? [];
  const needsDestination = !!dashboard?.current_run && !dashboard.current_run.destination_location_id && !dashboard.trip_endpoints?.some(endpoint => endpoint.role === 'Planned end location');
  const showDestinationEntry = needsDestination && runFilter === 'all';
  const visibleStops = filterRunStops([...(dashboard?.recorded_stops ?? []), ...(dashboard?.planned_delivery_stops ?? [])], runFilter);
  const offer = offers[0];

  async function contactDispatch() {
    const email = dashboard?.dispatch_email;
    if (!email) {
      messageSheet.current?.present('Contact dispatch', 'Your team has not added a dispatch contact yet. Ask your administrator for their contact details.');
      return;
    }
    try {
      await Linking.openURL(`mailto:${encodeURIComponent(email)}`);
    } catch {
      messageSheet.current?.present('Dispatch contact', email);
    }
  }

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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#ffffff' }} onLayout={event => setContainerHeight(event.nativeEvent.layout.height)}>
      <Animated.View style={mapStyle}>
        <RunMap runId={dashboard?.current_run?.run_id} token={session?.token} shipments={shipments} endpoints={dashboard?.trip_endpoints} topInset={insets.top} onOpenShipment={id => router.push(`/shipments/${id}`)} />
      </Animated.View>
      <PersistentBottomSheet topInset={insets.top} animatedPosition={sheetPosition}>
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 24 }}
        focusHook={useDashboardFocus}
        refreshing={loading && !!dashboard} onRefresh={() => void load()}
        showsVerticalScrollIndicator={false}>


        {loading && !dashboard ? <View style={{ paddingVertical: 48, alignItems: 'center', gap: 16 }}><ActivityIndicator size="large" color="#f54a4a" /><Text style={{ color: ink }}>Checking your current run…</Text></View> : <>
        {dashboard?.delivery_note_required_run_id ? (
          <Pressable style={[styles.documentNotice, { backgroundColor: dark ? '#401e22' : '#ffebed' }]} onPress={() => router.push({ pathname: '/shipments/load', params: { run_id: dashboard.delivery_note_required_run_id! } })} accessibilityRole="button">
            <Feather name="upload-cloud" size={24} color={dark ? '#fda4af' : '#a32136'} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: dark ? '#fda4af' : '#a32136' }}>Upload a delivery note</Text>
              <Text style={{ fontSize: 14, lineHeight: 21, color: dark ? '#fda4af' : '#a32136' }}>We’ve noticed you’re on the road and have no shipments attached to your run. Upload a delivery note now.</Text>
            </View>
            <Feather name="chevron-right" size={20} color={dark ? '#fda4af' : '#a32136'} />
          </Pressable>
        ) : null}

        {dashboard?.documents?.missing_required_count ? (
          <Pressable style={[styles.documentNotice, { backgroundColor: dark ? '#382b13' : '#fff4d6' }]} onPress={() => router.push('/(tabs)/documents')} accessibilityRole="button">
            <Feather name="file-text" size={22} color={dark ? '#fcd34d' : '#8a5700'} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: dark ? '#fde68a' : '#744700' }}>You have {dashboard.documents.missing_required_count} required {dashboard.documents.missing_required_count === 1 ? 'document' : 'documents'} to upload</Text>
            </View>
            <Feather name="chevron-right" size={20} color={dark ? '#fcd34d' : '#8a5700'} />
          </Pressable>
        ) : null}
        {dashboard?.documents?.expired_count ? (
          <Pressable style={[styles.documentNotice, { backgroundColor: dark ? '#401e22' : '#ffebed' }]} onPress={() => router.push('/(tabs)/documents')} accessibilityRole="button">
            <Feather name="alert-circle" size={22} color={dark ? '#fda4af' : '#a32136'} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: dark ? '#fda4af' : '#a32136' }}>You have {dashboard.documents.expired_count} expired {dashboard.documents.expired_count === 1 ? 'document' : 'documents'}</Text>
              <Text style={{ fontSize: 13, lineHeight: 19, color: dark ? '#fda4af' : '#a32136' }}>Review your documents and upload current replacements where needed.</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: dark ? '#fda4af' : '#a32136' }}>Review documents</Text>
            </View>
            <Feather name="chevron-right" size={20} color={dark ? '#fda4af' : '#a32136'} />
          </Pressable>
        ) : null}

        {error ? <Pressable accessibilityRole="button" accessibilityLabel="Retry loading dashboard" onPress={() => void load()} style={styles.error}><Text style={{ color: '#991b1b' }}>{dashboard ? `Showing saved data${lastUpdated ? ` from ${lastUpdated}` : ''}. ` : ''}{error} Tap to retry.</Text></Pressable> : null}

        {loading && !dashboard ? <ActivityIndicator style={{ paddingVertical: 70 }} size="large" color="#f54a4a" /> : dashboard?.current_run ? (
          <View style={[styles.deliveryCard, { backgroundColor: dark ? '#18181b' : '#ffffff' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Text style={[styles.runTitle, { color: ink, flexShrink: 1 }]}>{dashboard.current_run.status === 'in_progress' ? 'Current run' : 'Ready to start'}</Text>
              <Pressable onPress={openRunFilter} accessibilityRole="button" accessibilityLabel={`Current run view: ${runFilter === 'all' ? 'All stops' : runFilter === 'speeding' ? 'Speeding events' : 'Shipment deliveries'}`}
                style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: muted }}>{runFilter === 'all' ? 'All stops' : runFilter === 'speeding' ? 'Speeding events' : 'Shipment deliveries'}</Text>
                <Feather name="chevron-down" size={16} color={muted} />
              </Pressable>
            </View>
            <Text style={{ color: muted, marginTop: 8 }}>{shipments.length} shipments · {shipments.filter(s => !['delivered', 'failed', 'cancelled'].includes(s.status)).length} remaining · {shipments.filter(s => s.status === 'delivered').length} delivered</Text>
            {shipments.length > 0 && shipments.every(s => s.status === 'delivered') && <Text style={{ color: '#24753a', marginTop: 12 }}>Deliveries completed — awaiting dispatch closure.</Text>}
            {['draft', 'dispatched'].includes(dashboard.current_run.status) && <Pressable style={[styles.primary, { marginTop: 16 }]} disabled={starting} onPress={async () => {
              if (!session || !dashboard.current_run) return;
              setStarting(true); try { await documentImportApi.startRun(session.token, dashboard.current_run.run_id); await load(); } catch (e) { setError((e as Error).message); } finally { setStarting(false); }
            }} accessibilityRole="button"><Text style={styles.primaryText}>{starting ? 'Starting…' : 'Start run'}</Text></Pressable>}
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: muted, marginBottom: 12 }}>{visibleStops.length + (showDestinationEntry ? 1 : 0)} {runFilter === 'speeding' ? (visibleStops.length === 1 ? 'speeding event' : 'speeding events') : (visibleStops.length + (showDestinationEntry ? 1 : 0) === 1 ? 'timeline entry' : 'timeline entries')}{runFilter === 'shipments' ? ' for deliveries' : ''}</Text>
              {visibleStops.length ? visibleStops.map((stop, index, stops) => <View key={stop.stop_id} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineMarker, { backgroundColor: stop.kind === 'Speeding' ? '#dc2626' : stop.kind?.toLowerCase().includes('delivery') ? '#24753a' : stop.kind === 'Collection' ? '#2563eb' : '#71717a' }]}><Feather name={stop.kind === 'Speeding' ? 'alert-triangle' : 'map-pin'} size={14} color="#ffffff" /></View>
                  {index < stops.length - 1 || showDestinationEntry || !!stop.shipments?.length ? <View style={[styles.timelineConnector, { backgroundColor: line }]} /> : null}
                </View>
                <View style={[styles.timelineContent, { paddingBottom: 20 }]}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{stop.planned ? (stop.kind === 'Planned end' ? 'Planned end location' : 'Planned delivery') : stop.kind || 'Stop'}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`View ${stop.kind} details: ${stop.name}`} onPress={() => messageSheet.current?.present(`${stop.kind} · ${stop.name}`, [stop.address, stop.planned ? 'Planned endpoint' : stop.occurred_at ? new Date(stop.occurred_at).toLocaleString() : 'Time unavailable', stop.exited_at ? `Left ${new Date(stop.exited_at).toLocaleString()}` : null, stop.kind === 'Speeding' ? `Speed: ${stop.speed_kph ?? 'unavailable'} km/h · Limit: ${stop.speed_limit_kph ?? 'unavailable'} km/h` : null].filter(Boolean).join('\n'))}><Text style={[styles.shipmentTitle, { color: ink }]}>{stop.name} <Feather name="chevron-right" size={14} color={muted} /></Text></Pressable>
                  {stop.kind === 'Speeding' ? <Text style={{ color: '#b91c1c', fontSize: 13, marginTop: 6 }}>
                    {stop.speed_kph != null ? `${stop.speed_kph} km/h` : 'Speed not recorded'}{stop.speed_limit_kph != null ? ` · Limit ${stop.speed_limit_kph} km/h` : ' · Speed limit not recorded'}
                  </Text> : null}
                  {stop.address ? <Text style={[styles.shipmentRoute, { color: muted }]}>{stop.address}</Text> : null}
                  <Text style={{ fontSize: 12, color: muted, marginTop: 6 }}>{stop.planned ? 'Not visited yet' : stop.occurred_at ? new Date(stop.occurred_at).toLocaleString() : 'Time not recorded'}{stop.exited_at ? ` · Left ${new Date(stop.exited_at).toLocaleTimeString()}` : ''}</Text>
                  {!!stop.shipments?.length && <View>{stop.shipments.map(shipment => <Pressable key={shipment.shipment_id} onPress={() => router.push(`/shipments/${shipment.shipment_id}`)} accessibilityRole="button" style={styles.timelineShipmentLink}>
                    <View pointerEvents="none" accessible={false} style={[styles.timelineShipmentBranch, { borderColor: line }]} />
                    <Text style={{ color: '#e43e3e', fontSize: 12 }}>Open shipment · {shipment.reference || shipment.shipment_id}</Text>
                  </Pressable>)}</View>}
                </View>
              </View>) : <Text style={{ fontSize: 13, color: muted, marginBottom: 16 }}>{runFilter === 'speeding' ? 'No speeding events recorded for this run.' : runFilter === 'shipments' ? 'No visited or planned delivery stops for this run yet.' : 'No stops recorded or planned for this run yet.'}</Text>}
              {showDestinationEntry && <View style={styles.timelineRow}>
                <View style={styles.timelineRail}><View style={[styles.timelineMarker, { backgroundColor: '#71717a' }]}><Feather name="flag" size={14} color="#fff" /></View></View>
                <View style={[styles.timelineContent, { paddingBottom: 20, gap: 10 }]}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>Planned final destination</Text>
                  <Text style={{ color: muted }}>No final destination chosen for this run.</Text>
                  <Pressable accessibilityRole="button" onPress={() => setChoosingDestination(true)} style={styles.primary}><Text style={styles.primaryText}>Choose final destination</Text></Pressable>
                </View>
              </View>}
            </View>
          </View>
        ) : null}

        {dashboard && !dashboard.current_run ? <View style={{ paddingVertical: 24, gap: 12 }}><Text style={[styles.runTitle, { color: ink }]}>No current run</Text><Text style={{ color: muted }}>Upload a delivery note to prepare your next run.</Text></View> : null}
        <Pressable style={[styles.linkRow, { borderTopColor: line }]} onPress={() => router.push('/shipments/load')} accessibilityRole="button">
          <Feather name="upload-cloud" size={23} color={muted} /><Text style={{ color: ink, fontSize: 16, flex: 1 }}>Upload delivery note</Text><Feather name="chevron-right" size={22} color={muted} />
        </Pressable>

        <Pressable style={[styles.contactRow, { borderTopColor: line }]} onPress={() => void contactDispatch()} accessibilityRole="button">
          <Feather name="headphones" size={24} color={muted} /><Text style={{ color: ink, fontSize: 16, flex: 1 }}>Contact dispatch</Text><Feather name="chevron-right" size={22} color={muted} />
        </Pressable>

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
      </BottomSheetScrollView>
      </PersistentBottomSheet>
      <MessageSheet ref={messageSheet} />
      <ActionSheet ref={runFilterSheet} />
      {choosingDestination && session && dashboard?.current_run && <FinalDestinationSheet key={`${session.user.user_id}:${dashboard.current_run.run_id}`} token={session.token} runId={dashboard.current_run.run_id} onDismiss={() => setChoosingDestination(false)} onSaved={() => void load()} />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  documentNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 12, marginBottom: 14 },
  name: { fontSize: 17, fontWeight: '700' },
  date: { fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', textAlign: 'center', marginBottom: 14 },
  deliveryCard: { borderRadius: 16 },
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
  primary: { minHeight: 50, borderRadius: 10, backgroundColor: '#f54a4a', flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  primaryText: { color: '#ffffff', fontSize: 17, fontWeight: '600' },
  linkRow: { minHeight: 68, flexDirection: 'row', gap: 15, alignItems: 'center',borderTopWidth: 1, },
  contactRow: { borderTopWidth: 1, minHeight: 70, flexDirection: 'row', gap: 15, alignItems: 'center' },
  error: { backgroundColor: '#fee2e2', padding: 14, borderRadius: 10, marginBottom: 16 },
  offer: { marginTop: 14, paddingTop: 20, borderTopWidth: 1 },
});
