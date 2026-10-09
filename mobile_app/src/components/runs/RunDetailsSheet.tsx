import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, View } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheet } from '@/component/ui/BottomSheet';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { driverApi, type DriverRunDetail } from '@/src/lib/api';
import { RunSummaryCard } from './RunSummaryCard';
import { RunTimeline, type RunStop } from '../dashboard/RunTimeline';
import { StopDetailsSheet } from '../dashboard/StopDetailsSheet';
import { ShipmentDetailsSheet } from '../shipments/ShipmentDetails';

/** Authorized run details over the caller's retained screen and draft. */
export function RunDetailsSheet({ token, runId, onDismiss }: { token: string; runId: string; onDismiss: () => void }) {
  const modal = useRef<BottomSheetModal>(null);
  const shipmentModal = useRef<BottomSheetModal>(null);
  const request = useRef(0);
  const [run, setRun] = useState<DriverRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shipment, setShipment] = useState<string | null>(null);
  const [stop, setStop] = useState<RunStop | null>(null);
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const load = useCallback(async () => {
    const version = ++request.current;
    setLoading(true); setError('');
    try {
      const result = await driverApi.getRun(token, runId);
      if (version === request.current) setRun(result);
    } catch (failure) {
      if (version === request.current) { setRun(null); setError((failure as Error).message || 'Unable to load run.'); }
    } finally { if (version === request.current) setLoading(false); }
  }, [token, runId]);
  useEffect(() => {
    const lifetime = request;
    const frame = requestAnimationFrame(() => { modal.current?.present(); void load(); });
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { cancelAnimationFrame(frame); lifetime.current++; listener.remove(); };
  }, [load]);
  return <>
    <BottomSheet modalRef={modal} title={run?.reference || 'Run details'} scrollable onDismiss={onDismiss}>
      {loading && <ActivityIndicator accessibilityLabel="Loading run details" color="#15803d" />}
      {!!error && <View style={{ gap: 8 }}><Text accessibilityRole="alert">{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={{ minHeight: 44, justifyContent: 'center' }}><Text className="text-primary font-semibold">Retry loading run</Text></Pressable></View>}
      {run && <>
        <RunSummaryCard run={run} />
        {run.status === 'completed' && <Text className="text-muted-foreground">Completed · Read-only</Text>}
        <Text accessibilityRole="header" className="text-card-foreground text-lg font-semibold">Shipments</Text>
        {run.shipments.length ? run.shipments.map(item => <Pressable key={item.shipment_id} accessibilityRole="button" accessibilityLabel={`Open ${item.merchant_order_ref || item.delivery_note_number || item.shipment_id}`} onPress={() => setShipment(item.shipment_id)} className="bg-[#F5F5F8] dark:bg-card rounded-xl p-4 gap-2">
          <Text className="text-card-foreground font-semibold">{item.merchant_order_ref || item.delivery_note_number || item.shipment_id}</Text>
          <Text className="text-muted-foreground">{item.status.replaceAll('_', ' ')} · {item.dropoff_location?.full_address || 'No delivery address'}</Text>
        </Pressable>) : <Text className="text-muted-foreground">No shipments attached to this run.</Text>}
        <Text accessibilityRole="header" className="text-card-foreground text-lg font-semibold">Recorded timeline</Text>
        {run.recorded_stops.length ? <RunTimeline stops={run.recorded_stops} ink={dark ? '#fff' : '#111'} muted={dark ? '#a1a1aa' : '#71717a'} line={dark ? '#303036' : '#dedee1'} onOpenShipment={setShipment} onOpenStop={setStop} /> : <Text className="text-muted-foreground">No stops recorded yet.</Text>}
      </>}
    </BottomSheet>
    {shipment && run && <ShipmentDetailsSheet key={shipment} modalRef={shipmentModal} shipmentId={shipment} runId={run.status === 'completed' ? runId : undefined} autoPresent onDismiss={() => { setShipment(null); void load(); }} />}
    <StopDetailsSheet stop={stop} shipments={run?.shipments} onDismiss={() => setStop(null)} onOpenShipment={setShipment} />
  </>;
}
