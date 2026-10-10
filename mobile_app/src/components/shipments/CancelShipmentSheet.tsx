import { Feather } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { BottomSheet } from '@/component/ui/BottomSheet';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { driverApi, type CancelReason } from '@/src/lib/api';

export type ShipmentCancellation = { reason_code: string; reason?: string; note?: string };

/** Explicit cancellation save; server-provided reasons retain their original codes. */
export function CancelShipmentSheet({ token, busy, error, onSave, onDismiss }: {
  token: string; busy: boolean; error?: string | null;
  onSave: (payload: ShipmentCancellation) => void; onDismiss: () => void;
}) {
  const modal = useRef<BottomSheetModal>(null);
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const ink = dark ? '#fafafa' : '#18181b';
  const muted = dark ? '#a1a1aa' : '#71717a';
  const field = dark ? '#27272a' : '#f5f5f8';
  const border = dark ? '#45454d' : '#e4e4e7';
  const [reasons, setReasons] = useState<CancelReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState('');
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    const frame = requestAnimationFrame(() => modal.current?.present());
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    let current = true;
    void driverApi.listCancelReasons(token).then(response => {
      if (!current) return;
      const enabled = response.data.filter(reason => reason.enabled);
      setReasons([...enabled.filter(reason => reason.code !== 'other'), ...enabled.filter(reason => reason.code === 'other')]);
    }).catch(() => { if (current) setLoadError('Unable to load cancellation reasons. Please try again.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [token, reload]);
  const selected = reasons.find(reason => reason.code === code);
  const disabled = busy || loading || !!loadError || !selected || (code === 'other' && !custom.trim());
  const inputStyle = { color: ink, backgroundColor: field, borderColor: border, borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 52, fontSize: 16 };
  const saveAction = (
    <Pressable accessibilityRole="button" accessibilityLabel="Save cancellation" accessibilityHint="Cancels this shipment with the selected reason" accessibilityState={{ disabled, busy }} disabled={disabled} onPress={() => { if (!disabled) onSave({ reason_code: code, reason: code === 'other' ? custom.trim() : undefined, note: note.trim() || undefined }); }} style={{ minHeight: 52, borderRadius: 12, padding: 14, backgroundColor: '#dc2626', opacity: disabled ? 0.5 : 1, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
      {busy ? <ActivityIndicator color="#fff" accessibilityLabel="Saving cancellation" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Save cancellation</Text>}
    </Pressable>
  );
  return <BottomSheet modalRef={modal} title="Cancel shipment" keyboardBehavior="fillParent" footer={saveAction} scrollable contentPanning={false} stackBehavior="push" dismissible={!busy} onDismiss={onDismiss}>
    <Text style={{ color: muted, fontSize: 14, lineHeight: 21 }}>Choose a reason to cancel this shipment.</Text>
    <View style={{ gap: 8 }}>
      <Text style={{ color: ink, fontSize: 14, fontWeight: '600' }}>Reason · Required</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancellation reason" accessibilityValue={{ text: selected?.title || 'Choose a reason' }} accessibilityState={{ expanded, disabled: busy || loading || !!loadError || !reasons.length }} disabled={busy || loading || !!loadError || !reasons.length} onPress={() => setExpanded(!expanded)} style={{ ...inputStyle, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ flex: 1, color: selected ? ink : muted, fontSize: 16 }}>{loading ? 'Loading reasons…' : selected?.title || 'Choose a reason'}</Text>
        {loading ? <ActivityIndicator accessibilityLabel="Loading cancellation reasons" color="#15803d" /> : <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={muted} />}
      </Pressable>
      {expanded && !loading && !loadError && <View style={{ borderWidth: 1, borderColor: border, borderRadius: 12, overflow: 'hidden', backgroundColor: field }}>
        {reasons.map(reason => <Pressable key={reason.code} accessibilityRole="radio" accessibilityLabel={reason.title} accessibilityState={{ checked: code === reason.code, disabled: busy }} disabled={busy} onPress={() => { setCode(reason.code); setExpanded(false); }} style={{ minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: code === reason.code ? dark ? '#163829' : '#dcfce7' : field }}>
          <Text style={{ flex: 1, color: ink, fontSize: 15 }}>{reason.title}</Text>
          {code === reason.code && <Feather name="check" size={18} color={dark ? '#86efac' : '#15803d'} />}
        </Pressable>)}
      </View>}
    </View>
    {!loading && !loadError && !reasons.length && <Text style={{ color: muted }}>No cancellation reasons available.</Text>}
    {loadError && <View style={{ gap: 8 }}>
      <Text accessibilityRole="alert" style={{ color: dark ? '#fde68a' : '#92400e' }}>{loadError}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry cancellation reasons" disabled={busy} onPress={() => { setLoading(true); setLoadError(null); setReload(value => value + 1); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: dark ? '#86efac' : '#15803d', fontWeight: '600' }}>Retry</Text></Pressable>
    </View>}
    {code === 'other' && <View style={{ gap: 8 }}>
      <Text style={{ color: ink, fontSize: 14, fontWeight: '600' }}>Custom reason · Required</Text>
      <BottomSheetTextInput accessibilityLabel="Custom cancellation reason" value={custom} onChangeText={setCustom} editable={!busy} placeholder="Tell us why this shipment is being cancelled" placeholderTextColor={muted} multiline maxLength={1000} style={{ ...inputStyle, minHeight: 112, textAlignVertical: 'top' }} />
    </View>}
    <View style={{ gap: 8 }}>
      <Text style={{ color: ink, fontSize: 14, fontWeight: '600' }}>Note · Optional</Text>
      <BottomSheetTextInput accessibilityLabel="Cancellation note" value={note} onChangeText={setNote} editable={!busy} placeholder="Add a note" placeholderTextColor={muted} multiline maxLength={1000} style={{ ...inputStyle, minHeight: 88, textAlignVertical: 'top' }} />
    </View>
    {!!error && <Text accessibilityRole="alert" style={{ color: dark ? '#fde68a' : '#92400e', fontSize: 14, lineHeight: 21 }}>{error}</Text>}

  </BottomSheet>;
}
