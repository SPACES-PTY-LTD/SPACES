import { Feather } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { BottomSheet } from '@/component/ui/BottomSheet';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';

const FAILURE_REASONS = [
  'Recipient unavailable',
  'Delivery location closed',
  'Unable to access delivery location',
  'Incorrect or incomplete address',
  'Delivery refused',
  'Vehicle breakdown',
  'Other',
];
const STATUSES = [
  { value: 'booked', label: 'Booked' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'failed', label: 'Failed Delivery' },
];
export type DeliveryStatusUpdate = { status: string; note?: string };

/** Driver status form; collection odometer belongs to the collection flow. */
export function DeliveryStatusSheet({ status, onStatusChange, collectionOdometer, busy, error, onSave, onDismiss }: {
  status: string; onStatusChange: (status: string) => void;
  collectionOdometer?: number | null;
  busy: boolean; error?: string | null;
  onSave: (payload: DeliveryStatusUpdate) => void; onDismiss: () => void;
}) {
  const modal = useRef<BottomSheetModal>(null);
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const ink = dark ? '#fafafa' : '#18181b';
  const muted = dark ? '#a1a1aa' : '#71717a';
  const field = dark ? '#27272a' : '#f5f5f8';
  const border = dark ? '#45454d' : '#e4e4e7';
  const [open, setOpen] = useState<'status' | 'reason' | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    const frame = requestAnimationFrame(() => modal.current?.present());
    return () => cancelAnimationFrame(frame);
  }, []);
  const failed = status === 'failed';
  const missingCollection = status !== 'booked' && collectionOdometer == null;
  const failureNote = reason === 'Other' ? message.trim() : reason;
  const disabled = busy || missingCollection || (failed && !failureNote);
  const inputStyle = { color: ink, backgroundColor: field, borderColor: border, borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 52, fontSize: 16 };
  function dropdown(label: string, value: string, placeholder: string, kind: 'status' | 'reason', options: { value: string; label: string }[], select: (value: string) => void) {
    return <View style={{ gap: 8 }}>
      <Text style={{ color: ink, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: value || placeholder }} accessibilityState={{ expanded: open === kind, disabled: busy }} disabled={busy} onPress={() => setOpen(open === kind ? null : kind)} style={{ ...inputStyle, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ flex: 1, color: value ? ink : muted, fontSize: 16 }}>{value || placeholder}</Text>
        <Feather name={open === kind ? 'chevron-up' : 'chevron-down'} size={20} color={muted} />
      </Pressable>
      {open === kind && <View style={{ borderWidth: 1, borderColor: border, borderRadius: 12, overflow: 'hidden', backgroundColor: field }}>
        {options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: value === option.label, disabled: busy }} disabled={busy} onPress={() => { select(option.value); setOpen(null); }} style={{ minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: value === option.label ? dark ? '#163829' : '#dcfce7' : field }}>
          <Text style={{ flex: 1, color: ink, fontSize: 15 }}>{option.label}</Text>
          {value === option.label && <Feather name="check" size={18} color={dark ? '#86efac' : '#15803d'} />}
        </Pressable>)}
      </View>}
    </View>;
  }
  const saveAction = (
    <Pressable accessibilityRole="button" accessibilityLabel="Save status" accessibilityState={{ disabled, busy }} disabled={disabled} onPress={() => {
      if (disabled) return;
      onSave({ status, note: (failed ? failureNote : note.trim()) || undefined });
    }} style={{ minHeight: 52, borderRadius: 12, padding: 14, backgroundColor: '#15803d', opacity: disabled ? 0.5 : 1, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
      {busy ? <ActivityIndicator color="#fff" accessibilityLabel="Saving status" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Save status</Text>}
    </Pressable>
  );
  return <BottomSheet modalRef={modal} title="Delivery status" keyboardBehavior="fillParent" footer={saveAction} scrollable contentPanning={false} stackBehavior="push" dismissible={!busy} onDismiss={onDismiss}>
    <Text style={{ color: muted, fontSize: 14, lineHeight: 21 }}>Update the status of this shipment.</Text>
    {dropdown('Status', STATUSES.find(item => item.value === status)?.label || status, 'Choose a status', 'status', STATUSES, onStatusChange)}
    {failed ? <>
      {dropdown('Reason · Required', reason, 'Choose a reason', 'reason', FAILURE_REASONS.map(value => ({ value, label: value })), setReason)}
      {reason === 'Other' && <View style={{ gap: 8 }}>
        <Text style={{ color: ink, fontSize: 14, fontWeight: '600' }}>Message · Required</Text>
        <BottomSheetTextInput accessibilityLabel="Failure message" value={message} onChangeText={setMessage} editable={!busy} placeholder="Tell us why delivery could not be completed" placeholderTextColor={muted} multiline maxLength={1000} style={{ ...inputStyle, minHeight: 112, textAlignVertical: 'top' }} />
      </View>}
    </> : <View style={{ gap: 8 }}>
      <Text style={{ color: ink, fontSize: 14, fontWeight: '600' }}>Note · Optional</Text>
      <BottomSheetTextInput accessibilityLabel="Status note" value={note} onChangeText={setNote} editable={!busy} placeholder="Add a note" placeholderTextColor={muted} multiline maxLength={1000} style={{ ...inputStyle, minHeight: 88, textAlignVertical: 'top' }} />
    </View>}
    {missingCollection && <Text accessibilityRole="alert" style={{ color: dark ? '#fde68a' : '#92400e', fontSize: 14, lineHeight: 21 }}>Complete the pickup odometer in the collection flow before updating this status.</Text>}
    {!!error && <Text accessibilityRole="alert" style={{ color: dark ? '#fde68a' : '#92400e', fontSize: 14, lineHeight: 21 }}>{error}</Text>}

  </BottomSheet>;
}
