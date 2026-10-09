import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/component/ui/Text';
import { MessageSheet, type MessageSheetRef } from '@/component/ui/MessageSheet';
import { AccountRow, useAccountColors } from '@/src/components/AccountUI';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';
import { usePhoneLocation } from '@/src/providers/phone-location-provider';
import { useThemePreference } from '@/src/lib/theme-preference';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, signOut, updateSessionUser } = useAuth();
  const { colorScheme } = useColorScheme();
  const preference = useThemePreference();
  const colors = useAccountColors();
  const location = usePhoneLocation();
  const message = useRef<MessageSheetRef>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const updateUser = useRef(updateSessionUser);
  useEffect(() => { updateUser.current = updateSessionUser; }, [updateSessionUser]);
  const refreshLocation = location.refresh;
  const token = session?.token;
  useFocusEffect(useCallback(() => {
    if (!token) return;
    let live = true;
    void authApi.me(token).then(user => { if (live) return updateUser.current(user); }).catch(() => {});
    void refreshLocation();
    return () => { live = false; };
  }, [token, refreshLocation]));

  const user = session?.user;
  const name = user?.name || 'Driver account';
  const initials = name.trim().split(/\s+/).filter(Boolean).filter((_, i, parts) => i === 0 || i === parts.length - 1).map(part => [...part][0]).join('').toUpperCase();
  const merchant = user?.driver_merchant === undefined ? 'Merchant unavailable' : user.driver_merchant?.name || 'Merchant not assigned';
  const photo = user?.profile_photo_url;
  async function handleLogout() {
    setIsSubmitting(true);
    try { await signOut(); }
    catch (e) { message.current?.present('Unable to log out', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setIsSubmitting(false); }
  }
  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <View style={styles.identity}>
        {photo && failedPhoto !== photo ? <Image source={{ uri: photo }} accessibilityLabel={`${name}'s profile picture`} style={styles.avatar} contentFit="cover" onError={() => setFailedPhoto(photo)} /> : <View accessibilityLabel={`${name}'s profile picture placeholder`} style={[styles.avatar, styles.placeholder, { backgroundColor: colors.soft }]}><Text style={{ color: colors.accent, fontSize: 28, fontWeight: '600' }}>{initials}</Text></View>}
        <Text accessibilityRole="header" style={[styles.name, { color: colors.ink }]}>{name}</Text>
        <Text style={[styles.merchant, { color: colors.muted }]}>{merchant} · {user?.role ? user.role[0].toUpperCase() + user.role.slice(1) : 'Driver'}</Text>
      </View>
      <View style={styles.links}>
        <AccountRow label="Edit profile" icon="profile" onPress={() => router.push('/account/edit-profile')} />
        <AccountRow label="Vehicles" icon="vehicles" onPress={() => router.push('/account/vehicles')} />
        <AccountRow label="Notifications" icon="notifications" onPress={() => router.push('/account/notifications')} />
        <AccountRow label="Theme" icon="theme" detail={preference === 'system' ? 'System' : colorScheme === 'dark' ? 'Dark' : 'Light'} onPress={() => router.push('/account/theme')} />
        <AccountRow label="Location" icon="location" detail={location.loading ? 'Loading…' : location.settings ? location.settings.enabled ? 'On' : 'Off' : 'Unavailable'} hint="Manage phone location sharing. Turning it off alerts dispatch." onPress={() => router.push('/account/location')} last />
      </View>
      <Pressable disabled={isSubmitting} accessibilityRole="button" accessibilityLabel="Log out" accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }} onPress={handleLogout} style={styles.logout}>
        {isSubmitting ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.accent, fontSize: 17, lineHeight: 22, fontWeight: '600' }}>Log out</Text>}
      </Pressable>
    </ScrollView><MessageSheet ref={message} />
  </View>;
}
const styles = StyleSheet.create({
  identity: { alignItems: 'center', gap: 10 },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 20, lineHeight: 26, fontWeight: '600', textAlign: 'center' },
  merchant: { fontSize: 13, lineHeight: 17, textAlign: 'center' },
  links: { marginTop: 66, borderRadius: 18, overflow: 'hidden' },
  logout: { minHeight: 52, marginTop: 14, alignItems: 'center', justifyContent: 'center' },
});
