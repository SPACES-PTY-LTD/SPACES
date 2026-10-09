import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, Switch, View } from 'react-native';
import { Text } from '@/component/ui/Text';
import { AccountPage, accountStyles as styles, useAccountColors } from '@/src/components/AccountUI';
import { useAuth } from '@/src/providers/auth-provider';
import { registerMessageNotificationDevice } from '@/src/providers/message-notifications';

export default function NotificationsScreen() {
  const colors = useAccountColors();
  const { session } = useAuth();
  const currentToken = useRef(session?.token);
  useEffect(() => { currentToken.current = session?.token; }, [session?.token]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const busy = useRef(false);
  const active = useRef(false);
  const supported = Platform.OS !== 'web' && Constants.appOwnership !== 'expo';
  useFocusEffect(useCallback(() => {
    let live = true;
    active.current = true;
    async function read() {
      if (!supported) return;
      try { const permission = await Notifications.getPermissionsAsync(); if (live) { setEnabled(permission.granted); setError(null); } }
      catch { if (live) setError('Unable to read notification settings.'); }
    }
    void read();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void read(); });
    return () => { live = false; active.current = false; listener.remove(); };
  }, [supported]));
  async function openSettings() {
    try { await Linking.openSettings(); }
    catch { if (active.current) setError('Open your device settings to manage notifications for Spaces Digital.'); }
  }
  async function toggle(next: boolean) {
    if (!supported || busy.current || enabled === null) return;
    busy.current = true;
    setChanging(true);
    setError(null);
    try {
      if (!next) {
        await openSettings();
        return;
      }
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', {
        name: 'Messages', importance: Notifications.AndroidImportance.HIGH,
      });
      let permission = await Notifications.getPermissionsAsync();
      if (!active.current) return;
      if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
      if (!active.current) return;
      setEnabled(permission.granted);
      if (permission.granted && session?.token) {
        try { await registerMessageNotificationDevice(session.token, () => active.current && currentToken.current === session.token); }
        catch { if (active.current) setError('Permission is enabled, but notification setup failed. Reopen the app to retry.'); }
      }
      if (!permission.granted) {
        if (!permission.canAskAgain) await openSettings();
        else setError('Notifications are disabled. Turn the switch on to allow them.');
      }
    } catch {
      if (active.current) setError('Unable to change notification settings. Please try again.');
    } finally {
      busy.current = false;
      if (active.current) setChanging(false);
    }
  }
  return <AccountPage title="Notifications">
    <Text style={[styles.body, { color: colors.muted, marginTop: 12 }]}>Manage message notifications for this device.</Text>
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={[styles.label, { color: colors.ink, flex: 1 }]}>Message notifications</Text>
        <Switch accessibilityLabel="Message notifications" accessibilityHint={supported ? 'Allow notifications, or open device settings to change permission.' : 'Requires an installed mobile app.'} disabled={!supported || enabled === null || changing} value={enabled ?? false} onValueChange={next => { void toggle(next); }} trackColor={{ true: '#34C759' }} />
      </View>
      {!supported ? <Text style={[styles.body, { color: colors.muted }]}>Notifications require the installed mobile app and are unavailable in this preview.</Text> : (enabled === null && !error) || changing ? <ActivityIndicator color={colors.accent} /> : enabled !== null && <Text style={[styles.body, { color: colors.muted }]}>{enabled ? 'Enabled. Turn off in device settings.' : 'Disabled. Turn on to allow notifications.'}</Text>}
      {!!error && <Text accessibilityRole="alert" style={[styles.body, { color: colors.ink }]}>{error}</Text>}
    </View>
    <Text style={[styles.caption, { color: colors.muted, marginTop: 24 }]}>You can still read and send messages when notifications are disabled.</Text>
    {supported && <Pressable accessibilityRole="button" disabled={changing} onPress={() => { void openSettings(); }} style={{ minHeight: 52, marginTop: 16, justifyContent: 'center' }}><Text style={[styles.label, { color: colors.accent }]}>Open device settings</Text></Pressable>}
  </AccountPage>;
}
