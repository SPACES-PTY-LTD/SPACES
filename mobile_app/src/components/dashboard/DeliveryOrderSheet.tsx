import { Feather } from '@expo/vector-icons';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import { BottomSheet } from '@/component/ui/BottomSheet';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiRequestError, driverRunActionsApi, type RunDeliveryShipment } from '@/src/lib/api';

const ROW = 96;
export function DeliveryOrderSheet({ token, runId, onDismiss, onSaved }: {
  token: string; runId: string; onDismiss: () => void; onSaved: () => void;
}) {
  const modal = useRef<BottomSheetModal>(null);
  const list = useRef<ScrollView>(null);
  const viewport = useRef<View>(null);
  const scrollGesture = useMemo(() => Gesture.Native(), []);
  const { height } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const ink = dark ? '#fafafa' : '#18181b';
  const muted = dark ? '#a1a1aa' : '#71717a';
  const [rows, setRows] = useState<RunDeliveryShipment[]>([]);
  const [expected, setExpected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const alive = useRef(true);
  const submitting = useRef(false);
  const scroll = useRef(0);
  const bounds = useRef({ top: 0, height: 0 });
  const active = useRef<{ index: number; dy: number; startScroll: number; finger: number } | null>(null);
  const [drag, setDrag] = useState<{ index: number; dy: number } | null>(null);
  const listHeight = Math.min(height * 0.43, Math.max(ROW, rows.length * ROW));
  async function load() {
    setLoading(true); setError('');
    try {
      const data = await driverRunActionsApi.deliveryOrder(token, runId);
      if (!alive.current) return;
      setExpected(data.shipments.map(row => row.shipment_id));
      setRows(data.shipments); setConflict(false);
    } catch (failure) { if (alive.current) setError((failure as Error).message || 'Unable to load delivery order.'); }
    finally { if (alive.current) setLoading(false); }
  }
  useEffect(() => {
    alive.current = true;
    const frame = requestAnimationFrame(() => { modal.current?.present(); void load(); });
    return () => { alive.current = false; active.current = null; cancelAnimationFrame(frame); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const target = (index: number, dy: number) => Math.max(0, Math.min(rows.length - 1, index + Math.round(dy / ROW)));
  function move(from: number, to: number) {
    setRows(current => { const next = [...current]; const [row] = next.splice(from, 1); next.splice(to, 0, row); return next; });
  }
  function finish(cancelled = false) {
    const value = active.current;
    if (value && !cancelled) move(value.index, target(value.index, value.dy + scroll.current - value.startScroll));
    active.current = null; setDrag(null);
  }
  // Scroll near either edge while holding a shipment so long runs can be reordered.
  useEffect(() => {
    if (!drag) return;
    const timer = setInterval(() => {
      const value = active.current;
      if (!value) return;
      const { top, height: viewportHeight } = bounds.current;
      const direction = value.finger < top + 48 ? -1 : value.finger > top + viewportHeight - 48 ? 1 : 0;
      if (!direction) return;
      const next = Math.max(0, Math.min(rows.length * ROW - listHeight, scroll.current + direction * 12));
      scroll.current = next; list.current?.scrollTo({ y: next, animated: false });
      setDrag({ index: value.index, dy: value.dy + next - value.startScroll });
    }, 32);
    return () => clearInterval(timer);
  }, [!!drag, listHeight, rows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    if (submitting.current || drag || loading || conflict) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      await driverRunActionsApi.updateDeliveryOrder(token, runId, { shipment_ids: rows.map(row => row.shipment_id), expected_shipment_ids: expected });
      if (alive.current) { modal.current?.dismiss(); onSaved(); }
    } catch (failure) {
      if (alive.current) { setError((failure as Error).message || 'Unable to save delivery order.'); setConflict((failure as ApiRequestError).status === 409); }
    } finally { submitting.current = false; if (alive.current) setBusy(false); }
  }
  const changed = rows.some((row, index) => row.shipment_id !== expected[index]);
  return <BottomSheet modalRef={modal} title="Update delivery order" contentPanning={false} dismissible={!busy && !drag} onDismiss={onDismiss}>
    <Text style={{ color: muted }}>Drag the handles to choose what gets delivered first. Completed deliveries stay unchanged.</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: dark ? '#fde68a' : '#b45309' }}>{error}</Text>}
    {(conflict || (error && !rows.length)) && <Pressable accessibilityRole="button" onPress={() => void load()} disabled={loading || busy}><Text style={{ color: '#15803d', fontWeight: '600' }}>Reload delivery order</Text></Pressable>}
    {loading ? <ActivityIndicator color="#15803d" /> : !rows.length ? <Text style={{ color: muted }}>No remaining shipments to reorder.</Text> : <View ref={viewport} onLayout={() => viewport.current?.measureInWindow((_x, y, _width, h) => { bounds.current = { top: y, height: h }; })} style={{ height: listHeight }}>
      <GestureDetector gesture={scrollGesture}><ScrollView ref={list} scrollEnabled={!busy && (Platform.OS !== 'web' || !drag)} onScroll={event => { scroll.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 0 }}>
        {rows.map((row, index) => {
          const drop = drag ? target(drag.index, drag.dy) : -1;
          const translation = drag?.index === index ? drag.dy : drag && index > drag.index && index <= drop ? -ROW : drag && index < drag.index && index >= drop ? ROW : 0;
          return <View key={row.shipment_id} style={[styles.slot, { zIndex: drag?.index === index ? 2 : 0, transform: [{ translateY: translation }] }]}>
            <View style={[styles.card, { backgroundColor: dark ? '#27272a' : '#f7f7f8', borderColor: drag?.index === index ? '#15803d' : dark ? '#3f3f46' : '#e4e4e7' }]}>
              <Text style={{ color: '#15803d', fontWeight: '700', width: 26 }}>{index + 1}</Text>
              <View style={{ flex: 1, gap: 4 }}><Text numberOfLines={1} style={{ color: ink, fontWeight: '600' }}>{row.reference}</Text><Text numberOfLines={2} style={{ color: muted, fontSize: 13 }}>{row.destination || row.address || 'Delivery location unavailable'}</Text></View>
              <DeliveryDragHandle scrollGesture={scrollGesture} label={`Delivery ${index + 1}, ${row.reference}. Drag to reorder`} disabled={busy || conflict || rows.length < 2} color={muted}
                onStart={pageY => {
                  viewport.current?.measureInWindow((_x, y, _w, h) => { bounds.current = { top: y, height: h }; });
                  active.current = { index, dy: 0, startScroll: scroll.current, finger: pageY }; setDrag({ index, dy: 0 });
                }}
                onMove={(dy, pageY) => { if (active.current) { active.current.dy = dy; active.current.finger = pageY; setDrag({ index: active.current.index, dy: dy + scroll.current - active.current.startScroll }); } }}
                onFinish={finish} onAdjust={direction => { if (!busy && !conflict && !drag) move(index, Math.max(0, Math.min(rows.length - 1, index + direction))); }} />
            </View>
          </View>;
        })}
      </ScrollView></GestureDetector>
    </View>}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || loading || !!drag || conflict || !changed }} disabled={busy || loading || !!drag || conflict || !changed} onPress={() => void save()} style={[styles.save, { opacity: busy || loading || drag || conflict || !changed ? 0.5 : 1 }]}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Save delivery order</Text>}
    </Pressable>
  </BottomSheet>;
}
export function DeliveryDragHandle({ label, disabled, color, onStart, onMove, onFinish, onAdjust, scrollGesture }: {
  label: string; disabled: boolean; color: string; onStart: (y: number) => void;
  onMove: (dy: number, y: number) => void; onFinish: (cancelled?: boolean) => void; onAdjust: (direction: number) => void;
  scrollGesture: NativeGesture;
}) {
  const callbacks = useRef({ onStart, onMove, onFinish });
  useEffect(() => { callbacks.current = { onStart, onMove, onFinish }; }, [onStart, onMove, onFinish]);
  const dragging = useRef(false);
  // Keep the recognizer attached through drag-state renders. Native scrolling
  // waits for this handle to fail, rather than stealing its first movement.
  // RNGH registers these callbacks for touch events; it does not run them in render.
  /* eslint-disable react-hooks/refs */
  const pan = useMemo(() => Gesture.Pan().enabled(!disabled).minDistance(0).maxPointers(1)
    .blocksExternalGesture(scrollGesture).runOnJS(true)
    .onStart(event => { dragging.current = true; callbacks.current.onStart(event.absoluteY); })
    .onUpdate(event => callbacks.current.onMove(event.translationY, event.absoluteY))
    .onFinalize((event, success) => {
      if (!dragging.current) return;
      dragging.current = false;
      if (success) callbacks.current.onMove(event.translationY, event.absoluteY);
      callbacks.current.onFinish(!success);
    }), [disabled, scrollGesture]);
  /* eslint-enable react-hooks/refs */
  return <GestureDetector gesture={pan}><View collapsable={false} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityState={{ disabled }}
    accessibilityActions={[{ name: 'increment', label: 'Move later' }, { name: 'decrement', label: 'Move earlier' }]}
    onAccessibilityAction={event => { if (!disabled) onAdjust(event.nativeEvent.actionName === 'increment' ? 1 : -1); }} style={styles.handle}>
    <Feather name="menu" size={22} color={color} />
  </View></GestureDetector>;
}
const styles = StyleSheet.create({
  slot: { height: ROW, paddingBottom: 8 },
  card: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingLeft: 14, gap: 10 },
  handle: { width: 48, height: '100%', alignItems: 'center', justifyContent: 'center' },
  save: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#15803d' },
});
