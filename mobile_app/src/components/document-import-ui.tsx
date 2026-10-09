import { Feather } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { PropsWithChildren, type ReactNode, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/component/ui/Text';
import { BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { BottomSheet, type BottomSheetProps } from '@/component/ui/BottomSheet';

export function ImportSheetPage({ title, children, backDisabled = false, destination, plainScroll = false, showsVerticalScrollIndicator, onScroll, onBack, keyboardBehavior, footer }: PropsWithChildren<{ title: string; footer?: ReactNode; backDisabled?: boolean; destination?: Href; plainScroll?: boolean; showsVerticalScrollIndicator?: boolean; onScroll?: ScrollViewProps['onScroll']; onBack?: () => void; keyboardBehavior?: BottomSheetProps['keyboardBehavior'] }>) {
  const modalRef = useRef<BottomSheetModal>(null);
  const router = useRouter();
  useEffect(() => {
    const frame = requestAnimationFrame(() => modalRef.current?.present());
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { if (destination) modalRef.current?.dismiss(); }, [destination]);
  return <BottomSheet modalRef={modalRef} footer={footer} keyboardBehavior={keyboardBehavior} title={title} onBack={onBack} showCloseButton={!onBack} showHandle={!onBack} showsVerticalScrollIndicator={showsVerticalScrollIndicator} plainScroll={plainScroll} onScroll={onScroll} scrollable dismissible={!backDisabled} onDismiss={() => {
    if (destination) router.replace(destination);
    else if (router.canGoBack()) router.back(); else router.replace('/(tabs)');
  }}>{children}</BottomSheet>;
}

export function ImportPage({ title, children, backDisabled = false }: PropsWithChildren<{ title: string; backDisabled?: boolean }>) {
  const insets = useSafeAreaInsets(); const router = useRouter();
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f5f5f5' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 28, gap: 16 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={backDisabled} onPress={() => router.back()} style={{ paddingVertical: 10 }}><Feather name="arrow-left" size={26} color="#111" /></Pressable>
      <Text style={{ fontSize: 30, fontWeight: '800', color: '#111' }}>{title}</Text>{children}
    </ScrollView>
  </KeyboardAvoidingView>;
}
export function ImportButton({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, { backgroundColor: secondary ? '#fff' : '#15803d', opacity: disabled ? 0.5 : 1 }]}><Text style={{ color: secondary ? '#15803d' : '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>{label}</Text></Pressable>;
}
export function ImportField({ label, value, onChange, numeric = false, multiline = false, trailing }: { trailing?: ReactNode; label: string; value?: string | number | null; onChange: (value: string) => void; numeric?: boolean; multiline?: boolean }) {
  return <View style={{ gap: 6 }}><Text style={s.label}>{label}</Text><View style={{ flexDirection: trailing ? 'row' : 'column', alignItems: 'stretch', borderWidth: trailing ? 1 : 0, borderColor: '#d4d4d8', borderRadius: 4 }}><BottomSheetTextInput multiline={multiline} accessibilityLabel={label} value={value == null ? '' : String(value)} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} autoCapitalize="none" style={[s.input, trailing ? { flex: 1, borderWidth: 0 } : undefined]} placeholderTextColor="#777" />{trailing}</View></View>;
}
const s = StyleSheet.create({
  subtitle: { fontSize: 15, color: '#606067', lineHeight: 23 }, body: { fontSize: 15, color: '#111' },
  heading: { fontSize: 19, fontWeight: '700', color: '#111' }, card: { backgroundColor: '#fff', padding: 18, borderRadius: 16, gap: 16 },
  button: { minHeight: 50, padding: 14, borderRadius: 10, justifyContent: 'center' },
  choice: { borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 10 }, selected: { borderColor: '#15803d', backgroundColor: '#f0fdf4' },
  error: { color: '#92400e', backgroundColor: '#fef3c7', padding: 14, borderRadius: 10, lineHeight: 22 },
  note: { fontSize: 13, lineHeight: 20, color: '#666' }, label: { fontSize: 13, color: '#555' },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 4, padding: 12, color: '#111', backgroundColor: '#fff', fontSize: 15 },
});
export const importStyles = s;
