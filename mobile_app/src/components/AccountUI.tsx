import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';

const icons = {
  profile: { source: require('@/assets/images/account/profile.svg'), width: 14.5333, height: 16.7333 },
  vehicles: { source: require('@/assets/images/account/vehicles.svg'), width: 18.2, height: 15.45 },
  notifications: { source: require('@/assets/images/account/notifications.svg'), width: 18.2, height: 19.1167 },
  theme: { source: require('@/assets/images/account/theme.svg'), width: 17.1325, height: 17.1325 },
  location: { source: require('@/assets/images/account/location.svg'), width: 14.5333, height: 18.2 },
  chevron: { source: require('@/assets/images/account/chevron.svg'), width: 6.36667, height: 11.0333 },
  back: { source: require('@/assets/images/account/back.svg'), width: 8.11667, height: 14.5333 },
};
export function useAccountColors() {
  const dark = useColorScheme().colorScheme === 'dark';
  return { bg: dark ? '#121416' : '#F5F5F7', card: dark ? '#1F2327' : '#FFFFFF', ink: dark ? '#F6F7F8' : '#18181B', muted: dark ? '#A6AEB5' : '#6C6C74', accent: dark ? '#FF686E' : '#F4474C', soft: dark ? '#332125' : '#FFF0F0', line: dark ? '#33383D' : '#E7E7EC' };
}
export function AccountIcon({ kind }: { kind: keyof typeof icons }) {
  const asset = icons[kind];
  const colors = useAccountColors();
  return <View style={{ width: kind === 'chevron' ? 16 : 22, height: kind === 'chevron' ? 16 : 22, alignItems: 'center', justifyContent: 'center' }}><Image source={asset.source} style={{ width: asset.width, height: asset.height }} tintColor={kind === 'chevron' ? colors.muted : colors.accent} /></View>;
}
export function AccountRow({ label, icon, detail, onPress, disabled, last, hint }: { label: string; icon: keyof typeof icons; detail?: string; onPress: () => void; disabled?: boolean; last?: boolean; hint?: string }) {
  const colors = useAccountColors();
  return <TouchableOpacity activeOpacity={0.65} accessibilityRole="button" accessibilityLabel={detail ? `${label}, ${detail}` : label} accessibilityHint={hint} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, opacity: disabled ? 0.5 : 1 }]}>
    <AccountIcon kind={icon} /><Text style={[styles.rowLabel, { color: colors.ink }]}>{label}</Text>
    {!!detail && <Text style={[styles.caption, { color: icon === 'location' ? colors.accent : colors.muted }]}>{detail}</Text>}<AccountIcon kind="chevron" />
  </TouchableOpacity>;
}
export function AccountPage({ title, children }: { title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useAccountColors();
  return <View style={{ flex: 1, backgroundColor: colors.bg }}><ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to profile" onPress={() => router.back()} style={styles.back}><AccountIcon kind="back" /><Text style={[styles.body, { color: colors.accent }]}>Profile</Text></Pressable>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>{title}</Text>{children}
  </ScrollView></View>;
}
export const accountStyles = StyleSheet.create({
  card: { borderRadius: 18, padding: 18, marginTop: 32, gap: 10 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600', marginTop: 10 },
  body: { fontSize: 17, lineHeight: 22 },
  label: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 17 },
  choice: { minHeight: 68, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
});
const styles = StyleSheet.create({
  row: { minHeight: 68, paddingVertical: 16, paddingLeft: 16, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowLabel: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 17 },
  body: { fontSize: 17, lineHeight: 22 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 24 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
});
