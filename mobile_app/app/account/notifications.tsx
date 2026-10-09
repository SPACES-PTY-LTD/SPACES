import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, View } from 'react-native';
import { Text } from '@/component/ui/Text';
import { AccountPage, accountStyles as styles, useAccountColors } from '@/src/components/AccountUI';

export default function NotificationsScreen() {
  const colors = useAccountColors();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = Platform.OS !== 'web' && Constants.appOwnership !== 'expo';
  useFocusEffect(useCallback(() => {
    let live = true;
    async function read() {
      if (!supported) return;
      try { const permission = await Notifications.getPermissionsAsync(); if (live) { setEnabled(permission.granted); setError(null); } }
      catch { if (live) setError('Unable to read notification settings.'); }
    }
    void read();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void read(); });
    return () => { live = false; listener.remove(); };
  }, [supported]));
  return <AccountPage title="Notifications">
    <Text style={[styles.body, { color: colors.muted, marginTop: 12 }]}>Manage message notifications for this device.</Text>
    <View style={[styles.card, { backgroundColor: colors.card }]}><Text style={[styles.label, { color: colors.ink }]}>Message notifications</Text>
      {!supported ? <Text style={[styles.body, { color: colors.muted }]}>Notifications are available in the installed mobile app.</Text> : error ? <Text accessibilityRole="alert" style={[styles.body, { color: colors.ink }]}>{error}</Text> : enabled === null ? <ActivityIndicator color={colors.accent} /> : <Text style={[styles.body, { color: colors.muted }]}>{enabled ? 'Enabled' : 'Disabled'} in device settings</Text>}
    </View>
    <Text style={[styles.caption, { color: colors.muted, marginTop: 24 }]}>You can still read and send messages when notifications are disabled.</Text>
    {supported && <Pressable accessibilityRole="button" onPress={() => { void Linking.openSettings().catch(() => setError('Open your device settings to manage notifications for Spaces Digital.')); }} style={{ minHeight: 52, marginTop: 16, justifyContent: 'center' }}><Text style={[styles.label, { color: colors.accent }]}>Open device settings</Text></Pressable>}
  </AccountPage>;
}
