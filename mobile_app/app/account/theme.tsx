import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/component/ui/Text';
import { AccountPage, accountStyles as styles, useAccountColors } from '@/src/components/AccountUI';
import { setThemePreference, useThemePreference, type ThemePreference } from '@/src/lib/theme-preference';

export default function ThemeScreen() {
  const colors = useAccountColors();
  const preference = useThemePreference();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function select(next: ThemePreference) {
    setSaving(true);
    try { await setThemePreference(next); setError(null); }
    catch { setError('Unable to save your theme. Please try again.'); }
    finally { setSaving(false); }
  }
  return <AccountPage title="Theme"><Text style={[styles.body, { color: colors.muted, marginTop: 12 }]}>Choose how Spaces Digital looks on this device.</Text>
    <View accessibilityRole="radiogroup" style={{ borderRadius: 18, overflow: 'hidden', marginTop: 32 }}>
      {(['light', 'dark', 'system'] as const).map((value, index) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: preference === value, disabled: saving }} disabled={saving} onPress={() => { void select(value); }} style={[styles.choice, { backgroundColor: colors.card, borderBottomColor: colors.line, borderBottomWidth: index === 2 ? 0 : 1 }]}><Text style={[styles.label, { color: colors.ink, flex: 1 }]}>{value === 'system' ? 'Use device settings' : value === 'light' ? 'Light' : 'Dark'}</Text><Text style={{ color: colors.accent, fontSize: 20 }}>{preference === value ? '✓' : ''}</Text></Pressable>)}
    </View>{error && <Text accessibilityRole="alert" style={[styles.body, { color: colors.accent, marginTop: 20 }]}>{error}</Text>}
  </AccountPage>;
}
