import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Crypto from 'expo-crypto';
import { BottomSheet } from '@/component/ui/BottomSheet';
import { Text } from '@/component/ui/Text';
import { documentImportApi, driverRunActionsApi, type ImportLocation, type DriverDashboard } from '@/src/lib/api';
import { ImportButton, ImportField, importStyles as s } from '../document-import-ui';

import { LocationSearchPicker, type LocationSearchPickerHandle } from '../LocationSearchPicker';

export type RunAction = 'end' | 'edit' | 'cost';
export function RunActionForm({ action, token, run, onDismiss, onSaved }: {
  action: RunAction; token: string; run: NonNullable<DriverDashboard['current_run']>; onDismiss: () => void; onSaved: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const ink = dark ? '#fafafa' : '#18181b';
  const muted = dark ? '#a1a1aa' : '#71717a';
  const border = dark ? '#3f3f46' : '#e4e4e7';
  const surface = dark ? '#27272a' : '#f7f7f8';
  const modal = useRef<BottomSheetModal>(null);
  const picker = useRef<LocationSearchPickerHandle>(null);
  const submitting = useRef(false);
  const alive = useRef(true);
  const request = useRef(0);
  const retry = useRef<{ signature: string; id: string } | null>(null);
  const [reason, setReason] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [focusedCostField, setFocusedCostField] = useState<'description' | 'amount' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [origin, setOrigin] = useState<ImportLocation>();
  const [destination, setDestination] = useState<ImportLocation>();
  const [choosing, setChoosing] = useState<'origin' | 'destination' | null>(null);
  const [loading, setLoading] = useState(action === 'edit');
  // Capture the edit's original endpoints once; background refresh cannot overwrite a draft.
  const expected = useRef({ origin_location_id: run.origin_location_id ?? null, destination_location_id: run.destination_location_id ?? null });
  const heading = action === 'end' ? 'End Run' : action === 'edit' ? 'Edit Run' : 'Add additional cost';
  async function loadEndpoints() {
    const version = ++request.current;
    setLoading(true); setError('');
    try {
      const list = (await documentImportApi.context(token)).locations;
      if (!alive.current || version !== request.current) return;
      const valid = list.filter(location => location.latitude != null && location.longitude != null);
      setOrigin(current => current ?? valid.find(location => location.location_id === expected.current.origin_location_id));
      setDestination(current => current ?? valid.find(location => location.location_id === expected.current.destination_location_id));
    } catch (failure) { if (alive.current && version === request.current) setError((failure as Error).message || 'Unable to load locations. Retry.'); }
    finally { if (alive.current && version === request.current) setLoading(false); }
  }
  useEffect(() => {
    alive.current = true;
    const lifetime = request;
    const frame = requestAnimationFrame(() => { modal.current?.present(); if (action === 'edit') void loadEndpoints(); });
    return () => { alive.current = false; lifetime.current++; cancelAnimationFrame(frame); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    if (submitting.current) return;
    if (action === 'end' && !reason.trim()) { setError('Enter a reason for ending this run.'); return; }
    if (action === 'cost' && (!title.trim() || title.trim().length > 255 || !/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$/.test(amount.trim()) || !/[1-9]/.test(amount))) {
      setError('Enter a description and a positive ZAR amount with up to two decimal places.'); return;
    }
    if (action === 'edit' && (!origin || !destination)) { setError('Choose both run endpoints.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      if (action === 'end') await driverRunActionsApi.requestEnd(token, run.run_id, reason.trim());
      else if (action === 'edit') await driverRunActionsApi.endpoints(token, run.run_id, {
        origin_location_id: origin!.location_id, destination_location_id: destination!.location_id,
        expected_origin_location_id: expected.current.origin_location_id, expected_destination_location_id: expected.current.destination_location_id,
      });
      else {
        const signature = JSON.stringify([title.trim(), amount.trim()]);
        if (retry.current?.signature !== signature) retry.current = { signature, id: Crypto.randomUUID() };
        await driverRunActionsApi.cost(token, run.run_id, { title: title.trim(), amount: amount.trim(), client_request_id: retry.current.id });
      }
      if (alive.current) { modal.current?.dismiss(); onSaved(); }
    } catch (failure) { if (alive.current) setError((failure as Error).message || 'Unable to save. Please retry.'); }
    finally { submitting.current = false; if (alive.current) setBusy(false); }
  }
  const address = (location?: ImportLocation) => location?.full_address || [location?.address_line_1, location?.city, location?.province, location?.country].filter(Boolean).join(', ');
  return <BottomSheet showCloseButton={!choosing} plainScroll={!!choosing} modalRef={modal} title={choosing ? choosing === 'origin' ? 'Search planned start location' : 'Search planned end location' : heading} onBack={choosing ? () => { Keyboard.dismiss(); setChoosing(null); } : undefined} keyboardBehavior="interactive" onScroll={event => picker.current?.onScroll(event)} showHandle={action !== 'edit'} scrollable dismissible={!busy} onDismiss={onDismiss}>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {action === 'end' && <>
      <Text style={s.subtitle}>Request dispatch approval to end this run. Your run stays active until dispatch approves it, even if deliveries remain unfinished.</Text>
      <ImportField label="Reason" multiline value={reason} onChange={setReason} />
    </>}
    {action === 'cost' && <>
      <View style={[styles.notice, { backgroundColor: surface }]}><Feather name="file-text" size={18} color={muted} /><Text style={[styles.note, { color: muted }]}>Record an extra expense for this run.</Text></View>
      <View style={styles.costField}>
        <Text style={[styles.fieldLabel, { color: ink }]}>Description</Text>
        <View style={[styles.costInput, { backgroundColor: surface, borderColor: focusedCostField === 'description' ? '#15803d' : border }]}>
          <BottomSheetTextInput accessibilityLabel="Description" value={title} onChangeText={setTitle} editable={!busy} maxLength={255} placeholder="e.g. Parking or toll fees" placeholderTextColor={muted} autoCapitalize="sentences" onFocus={() => setFocusedCostField('description')} onBlur={() => setFocusedCostField(null)} style={[styles.descriptionInput, { color: ink }]} />
        </View>
      </View>
      <View style={styles.costField}>
        <Text style={[styles.fieldLabel, { color: ink }]}>Amount (ZAR)</Text>
        <View style={[styles.costInput, styles.amountRow, { backgroundColor: surface, borderColor: focusedCostField === 'amount' ? '#15803d' : border }]}>
          <Text style={[styles.currency, { color: muted, borderColor: border }]}>R</Text>
          <BottomSheetTextInput accessibilityLabel="Amount in South African rand" value={amount} onChangeText={setAmount} editable={!busy} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={muted} onFocus={() => setFocusedCostField('amount')} onBlur={() => setFocusedCostField(null)} style={[styles.amountInput, { color: ink }]} />
        </View>
        <Text style={[styles.fieldHint, { color: muted }]}>Enter the total in rand, including cents.</Text>
      </View>
    </>}
    {action === 'edit' && <>
      {choosing ? <>
        <LocationSearchPicker key={choosing} ref={picker} token={token} selectedLabel={choosing === 'origin' ? 'SELECTED STARTING POINT' : 'SELECTED PLANNED END'} selectionIcon={choosing === 'origin' ? 'map-pin' : 'flag'} confirmLabel={choosing === 'origin' ? 'Use starting point' : 'Use planned end location'} onConfirm={location => {
          if (choosing === 'origin') setOrigin(location); else setDestination(location);
          setChoosing(null); setError('');
        }} />
      </> : <>
        <View style={[styles.notice, { backgroundColor: surface }]}><Feather name="info" size={16} color={muted} /><Text style={[styles.note, { color: muted }]}>Update the planned start and end. Deliveries and recorded visits stay the same.</Text></View>
        {loading && <ActivityIndicator color="#15803d" />}
        {(['origin', 'destination'] as const).map(role => {
          const location = role === 'origin' ? origin : destination;
          const isOrigin = role === 'origin';
          const accent = isOrigin ? (dark ? '#93c5fd' : '#2563eb') : '#15803d';
          return <View key={role} style={[styles.endpoint, { borderColor: border }]}>
            <View style={styles.endpointHeader}>
              <View style={[styles.marker, { backgroundColor: isOrigin ? (dark ? '#1e304f' : '#eff6ff') : (dark ? '#14532d' : '#f0fdf4') }]}><Feather name={isOrigin ? 'map-pin' : 'flag'} size={18} color={accent} /></View>
              <Text style={[styles.endpointLabel, { color: muted }]}>{isOrigin ? 'STARTING POINT' : 'PLANNED END'}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`${location ? 'Change' : 'Choose'} ${isOrigin ? 'run starting point' : 'planned end location'}`} disabled={busy || loading} onPress={() => { setChoosing(role); setError(''); }} style={[styles.change, { backgroundColor: surface, opacity: busy || loading ? 0.45 : 1 }]}><Text style={{ color: ink, fontSize: 12, fontWeight: '600' }}>{location ? 'Change' : 'Choose'}</Text><Feather name="chevron-right" size={14} color={muted} /></Pressable>
            </View>
            <View style={styles.endpointBody}><Text style={[styles.locationName, { color: ink }]}>{location?.name || (loading ? 'Loading location…' : isOrigin ? 'Choose a starting point' : 'Choose an end location')}</Text>
              <Text style={[styles.address, { color: muted }]}>{location ? address(location) : (loading ? 'Please wait while we load your run.' : isOrigin ? 'Select where this run starts.' : 'Select where this run will finish.')}</Text>
            </View>
          </View>;
        })}
        {!!error && <ImportButton secondary label="Retry loading locations" disabled={busy || loading} onPress={() => void loadEndpoints()} />}
      </>}
    </>}
    {action === 'edit' || action === 'cost' ? <>
      {!choosing && <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || loading || (action === 'edit' && (!origin || !destination)) }} disabled={busy || loading || (action === 'edit' && (!origin || !destination))} onPress={() => void save()} style={[styles.save, { opacity: busy || loading || (action === 'edit' && (!origin || !destination)) ? 0.45 : 1 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Feather name={action === 'cost' ? 'plus' : 'check'} size={18} color="#fff" />}<Text style={styles.saveText}>{busy ? 'Saving…' : action === 'cost' ? 'Add cost' : 'Save endpoints'}</Text></Pressable>}
      {action === 'edit' && !choosing && <Pressable accessibilityRole="button" disabled={busy} onPress={() => modal.current?.dismiss()} style={styles.cancel}><Text style={{ color: ink, fontSize: 14, fontWeight: '600' }}>Cancel</Text></Pressable>}
    </> : <>
    {!choosing && <ImportButton label={busy ? 'Saving…' : action === 'end' ? 'Request approval' : 'Add cost'} disabled={busy || loading || (action === 'end' && !reason.trim())} onPress={() => void save()} />}
    <ImportButton secondary label="Cancel" disabled={busy} onPress={() => modal.current?.dismiss()} />
    </>}
  </BottomSheet>;
}

const styles = StyleSheet.create({
  costField: { gap: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '600' },
  costInput: { minHeight: 54, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  descriptionInput: { minHeight: 54, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },
  amountRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  currency: { fontSize: 18, fontWeight: '600', borderRightWidth: 1, paddingRight: 12, marginRight: 12 },
  amountInput: { flex: 1, minWidth: 0, minHeight: 58, paddingVertical: 12, fontSize: 24, fontWeight: '600' },
  fieldHint: { fontSize: 12, lineHeight: 18 },
  notice: { borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  note: { flex: 1, fontSize: 13, lineHeight: 19 },
  endpoint: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  endpointHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  marker: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  endpointLabel: { flex: 1, fontSize: 10, letterSpacing: 0.6, fontWeight: '700' },
  change: { minHeight: 44, paddingHorizontal: 12, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 4 },
  endpointBody: { gap: 6 },
  locationName: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  address: { fontSize: 13, lineHeight: 19 },
  save: { minHeight: 50, backgroundColor: '#15803d', borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancel: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
