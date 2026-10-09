import { useRef } from 'react';
import { ActivityIndicator, Linking, Pressable, Switch, View } from 'react-native';
import { Text } from '@/component/ui/Text';
import { MessageSheet, type MessageSheetRef } from '@/component/ui/MessageSheet';
import { AlertSheet, type AlertSheetRef } from '@/component/ui/AlertSheet';
import { AccountPage, accountStyles as styles, useAccountColors } from '@/src/components/AccountUI';
import { usePhoneLocation } from '@/src/providers/phone-location-provider';

export default function LocationScreen() {
  const colors = useAccountColors();
  const { settings, loading, saving, error, permissionRequired, refresh, setEnabled } = usePhoneLocation();
  const message = useRef<MessageSheetRef>(null);
  const alert = useRef<AlertSheetRef>(null);
  const change = async (enabled: boolean) => {
    try { await setEnabled(enabled); }
    catch (e) { message.current?.present('Unable to change location sharing', e instanceof Error ? e.message : 'Please try again.'); }
  };
  function toggle(enabled: boolean) {
    if (!settings || loading || saving) return;
    if (enabled) { void change(true); return; }
    if (!settings.enabled) return;
    alert.current?.present('Dispatch will be alerted', 'If you turn location off, dispatch will be alerted. You can turn it back on at any time.', () => change(false));
  }
  return <><AccountPage title="Location">
    <Text style={[styles.heading, { color: colors.ink }]}>Keep dispatch informed</Text>
    <Text style={[styles.body, { color: colors.muted, marginTop: 12 }]}>Share your phone location so dispatch can coordinate your deliveries.</Text>
    <View style={[styles.card, { backgroundColor: colors.card, marginTop: 48 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1, gap: 6 }}>
        <Text style={[styles.label, { color: colors.ink }]}>Share location</Text>
        <Text style={[styles.caption, { color: colors.accent }]}>{loading ? 'Loading settings…' : !settings ? 'Settings unavailable' : saving ? 'Saving…' : settings.enabled ? 'Location is on' : 'Location is off'}</Text>
      </View>{loading || saving ? <ActivityIndicator color={colors.accent} /> : <Switch accessibilityLabel="Share phone location" disabled={!settings} value={settings?.enabled ?? false} onValueChange={toggle} trackColor={{ true: '#34C759' }} />}</View>
    </View>
    <Text style={[styles.caption, { color: colors.muted, marginTop: 32 }]}>Your phone location is shared while the app is open. Sharing pauses in the background. Vehicle tracker data is separate.</Text>
    {!!settings?.last_reported_at && settings.enabled && <Text style={[styles.caption, { color: colors.muted, marginTop: 12 }]}>Last shared: {new Date(settings.last_reported_at).toLocaleString()}</Text>}
    {!!error && <View style={[styles.card, { backgroundColor: colors.card }]}><Text accessibilityRole="alert" style={[styles.body, { color: colors.ink }]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => { void refresh(); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontWeight: '600' }}>Retry</Text></Pressable></View>}
    {permissionRequired && <Pressable accessibilityRole="button" onPress={() => { void Linking.openSettings().catch(() => message.current?.present('Unable to open settings', 'Open your device settings and allow location access for Spaces Digital.')); }} style={{ minHeight: 52, marginTop: 12, justifyContent: 'center' }}><Text style={[styles.label, { color: colors.accent }]}>Open device settings</Text></Pressable>}
  </AccountPage><AlertSheet ref={alert} /><MessageSheet ref={message} /></>;
}
