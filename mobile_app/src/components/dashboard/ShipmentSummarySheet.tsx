import { Feather } from '@expo/vector-icons';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomSheet } from '@/component/ui/BottomSheet';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DriverShipment } from '@/src/lib/api';
import { summaryShipments, type ShipmentSummaryFilter } from './shipment-summary';

export function ShipmentSummarySheet({ shipments, filter, onDismiss, onOpenShipment }: {
  shipments: DriverShipment[]; filter: ShipmentSummaryFilter; onDismiss: () => void; onOpenShipment: (id: string) => void;
}) {
  const modal = useRef<BottomSheetModal>(null);
  const pending = useRef<string | null>(null);
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const ink = dark ? '#fafafa' : '#18181b';
  const muted = dark ? '#a1a1aa' : '#71717a';
  const rows = summaryShipments(shipments, filter);
  useEffect(() => {
    modal.current?.present();
    const selection = pending;
    return () => { selection.current = null; };
  }, []);
  function dismissed() {
    const id = pending.current;
    pending.current = null;
    onDismiss();
    // The shared sheet calls this after its native overlay has detached.
    if (id && rows.some(shipment => shipment.shipment_id === id)) onOpenShipment(id);
  }
  return <BottomSheet modalRef={modal} title={filter === 'Shipments' ? 'Run shipments' : `${filter} shipments`}
    scrollable contentPanning={false} onDismiss={dismissed}>
    <Text style={{ color: muted }}>{rows.length} {rows.length === 1 ? 'shipment' : 'shipments'}</Text>
    {!rows.length && <Text style={{ color: muted, paddingVertical: 24 }}>{filter === 'Shipments' ? 'No shipments in this run.' : `No ${filter.toLowerCase()} shipments in this run.`}</Text>}
    {rows.map(shipment => <Pressable key={shipment.shipment_id} accessibilityRole="button"
      accessibilityLabel={`Open shipment ${shipment.merchant_order_ref || shipment.shipment_id}`}
      onPress={() => { if (pending.current) return; pending.current = shipment.shipment_id; modal.current?.dismiss(); }}
      style={[styles.row, { backgroundColor: dark ? '#27272a' : '#f5f5f8' }]}>
      <View style={styles.identity}>
        <Text style={{ color: ink, fontSize: 16, fontWeight: '600' }}>{shipment.merchant_order_ref || 'Shipment'}</Text>
        <Text style={{ color: ink, fontSize: 14 }}>{shipment.dropoff_location?.name || shipment.dropoff_location?.full_address || 'Delivery location unavailable'}</Text>
        <Text style={{ color: muted, fontSize: 12 }}>{shipment.status.replaceAll('_', ' ')}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={muted} />
    </Pressable>)}
  </BottomSheet>;
}

const styles = StyleSheet.create({
  row: { minHeight: 72, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  identity: { flex: 1, gap: 6 },
});
