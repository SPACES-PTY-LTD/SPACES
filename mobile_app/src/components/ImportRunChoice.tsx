import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ImportContext, ImportDraft, ImportReview } from '@/src/lib/api';

const assets = {
  selected: require('@/assets/images/import-run-choice/radio-selected.svg'),
  unselected: require('@/assets/images/import-run-choice/radio-unselected.svg'),
  start: require('@/assets/images/import-run-choice/start-dot.svg'),
  end: require('@/assets/images/import-run-choice/end-dot.svg'),
};

export function ImportRunChoice({ context, draft, review, ready, busy, start, end, onSelectRun, onChooseVehicle, statusLabel }: {
  context: ImportContext; draft: ImportDraft; review?: ImportReview; ready: boolean; busy: boolean;
  start: string; end: string; onSelectRun: (id: string | null) => void; onChooseVehicle: () => void;
  statusLabel: (status: string) => string;
}) {
  const dark = useColorScheme().colorScheme === 'dark';
  const colors = { ink: dark ? '#fafafa' : '#111', muted: dark ? '#a1a1aa' : '#71717a', card: dark ? '#18181b' : '#f5f5f8', panel: dark ? '#27272a' : '#fff', line: dark ? '#52525c' : '#cfcfd6', brand: '#f54a4a', highlight: dark ? '#3b2124' : '#fff0f0' };
  const rows = ready ? review?.rows.filter(row => row.eligibility === 'new') || [] : [];
  const vehicle = context.vehicles.find(item => item.vehicle_id === draft.vehicle_id);
  const route = () => <View style={styles.route}>
    {([['RUN START', start, assets.start], ['PLANNED END', end, assets.end]] as const).map(([label, address, source]) => <View key={label} style={styles.routeRow}>
      <Image source={source} style={styles.dot} contentFit="contain" tintColor={label === 'PLANNED END' && dark ? colors.ink : undefined} accessible={false} />
      <View style={styles.copy}><Text style={[styles.caption, { color: colors.muted }]}>{label}</Text><Text style={[styles.address, { color: colors.ink }]}>{address || 'Location unavailable'}</Text></View>
    </View>)}
  </View>;
  const option = (id: string | null, label: string, subtitle: string) => {
    const selected = id ? !draft.create_new_run && draft.run_id === id : !!draft.create_new_run;
    const existing = !!id;
    return <Pressable key={id || 'new'} accessibilityRole="radio" accessibilityLabel={`${label}, ${subtitle}`} accessibilityState={{ checked: selected, disabled: busy }} disabled={busy} onPress={() => onSelectRun(id)} style={[styles.option, { backgroundColor: existing ? colors.card : selected ? colors.highlight : colors.panel, borderColor: selected ? colors.brand : colors.line, opacity: busy ? 0.5 : 1 }]}>
      <View style={styles.optionRow}>
        <Image source={selected ? assets.selected : assets.unselected} style={styles.radio} contentFit="contain" accessible={false} />
        <View style={styles.copy}><Text style={[styles.optionTitle, { color: colors.ink }]}>{label}</Text><Text style={[styles.meta, { color: colors.muted }]}>{subtitle}</Text></View>
      </View>
      {selected && <><View style={{ height: 1, backgroundColor: colors.line }} />{route()}</>}
    </Pressable>;
  };
  return <View style={styles.content}>
    <Text style={[styles.address, { color: colors.muted }]}>{context.runs.length ? 'Add this delivery note to your current run or create a new one.' : 'No current run is available. Create a new run for this delivery note.'}</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Choose destination run" style={styles.options}>
      {context.runs.map(run => option(run.run_id, run.label, `${run.status === 'in_progress' ? 'In progress' : 'Ready to start'} · Add to this run${run.vehicle_id ? ` · ${context.vehicles.find(item => item.vehicle_id === run.vehicle_id)?.label || 'Assigned vehicle'}` : ''}`))}
      {option(null, 'Create new run', 'Ready to start after creation')}
    </View>
    {draft.create_new_run && <>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose assigned vehicle" accessibilityState={{ disabled: busy || !context.vehicles.length }} disabled={busy || !context.vehicles.length} onPress={onChooseVehicle} style={[styles.vehicle, { backgroundColor: colors.card, opacity: busy ? 0.5 : 1 }]}>
        <Text style={[styles.meta, { color: colors.muted }]}>Assigned vehicle</Text>
        <View style={styles.vehicleRow}><Text style={[styles.vehicleLabel, { color: colors.ink }]}>{vehicle?.label || 'Select your vehicle'}</Text><Text style={{ color: colors.muted }}>⌄</Text></View>
      </Pressable>
      {!context.vehicles.length && <Text accessibilityRole="alert" style={{ color: dark ? '#ff8585' : '#a32222' }}>Ask dispatch to assign a vehicle before creating a run.</Text>}
    </>}
    {ready ? <View style={styles.summary}>
      <View style={styles.summaryHeading}><Text style={[styles.summaryTitle, { color: colors.ink }]}>{rows.length} new shipments</Text><Text style={[styles.meta, { color: colors.muted }]}>· {rows.filter(row => row.status === 'delivered').length} delivered</Text></View>
      {rows.map(row => <View key={row.index} style={styles.shipment}>
        <Text style={[styles.reference, { color: colors.ink }]}>{row.reference}</Text>
        <View style={styles.status}><Text style={[styles.meta, { color: colors.muted }]}>{statusLabel(row.status)}</Text>{row.matched_stop && <Text style={[styles.meta, { color: colors.muted }]}>{row.matched_stop.name}</Text>}</View>
      </View>)}
      <Text style={[styles.explanation, { color: colors.muted }]}>{draft.create_new_run ? 'Previous-run matches are removed. Your manual status changes are kept.' : 'Recorded stops are kept. Matched visits on this run will be linked. Review any status changes before confirming.'}</Text>
    </View> : <Text accessibilityLiveRegion="polite" style={[styles.meta, { color: colors.muted }]}>{busy ? 'Checking the selected run…' : 'Select a run option to review its final shipment statuses.'}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: 12 }, options: { gap: 12 }, option: { padding: 12, gap: 12, borderWidth: 1, borderRadius: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 4, minHeight: 44 }, radio: { width: 44, height: 44 },
  copy: { flex: 1, gap: 4 }, optionTitle: { fontSize: 17, lineHeight: 23, fontWeight: '600' }, meta: { fontSize: 13, lineHeight: 18 },
  route: { gap: 12 }, routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, dot: { width: 8, height: 8, marginTop: 4 },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '600' }, address: { fontSize: 14, lineHeight: 19 },
  vehicle: { padding: 12, borderRadius: 12, gap: 8, minHeight: 44 }, vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vehicleLabel: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '600' }, summary: { gap: 8 }, summaryHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  summaryTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' }, shipment: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  reference: { flex: 1, fontSize: 14, lineHeight: 19 }, status: { flex: 1, alignItems: 'flex-end' }, explanation: { fontSize: 12, lineHeight: 17, marginTop: 4 },
});
